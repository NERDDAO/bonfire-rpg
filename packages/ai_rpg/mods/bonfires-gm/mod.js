/**
 * Bonfires GM Mod — P2P networked multiplayer for ai_rpg.
 *
 * HOST MODE: Runs WS server + GM cron. Processes stacks, triggers GM
 *   decisions, broadcasts to all connected clients.
 * CLIENT MODE: Connects WS to host. Pushes to Delve stack directly
 *   via SDK. Receives GM decisions and applies them natively.
 *
 * Both modes: push action summaries to Bonfires stack (no LLM call),
 * query KG for cross-player world knowledge, inject into AI prompts.
 */

const { BonfiresClient } = require('./bonfires-sdk');
const { KGContext } = require('./kg-context');
const { GameKG } = require('./game-kg');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

function register(scope) {
  const { app, realtimeHub, modDir, registerModRoute, promptEnv,
    Player, Thing, Quest, Region, Location, LocationExit, Events,
    players, things, regions, gameLocations, factions,
    findActorByName, findThingByName, pushChatEntry,
  } = scope;

  const configPath = path.join(modDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  if (!config.bonfire_id || !config.agent_id) {
    console.log('[bonfires-gm] Not configured — set bonfire_id, agent_id, delve_api_key');
    registerConfigRoutes();
    return;
  }

  const sdk = new BonfiresClient({
    baseUrl: config.delve_base_url,
    apiKey: config.delve_api_key,
    bonfireId: config.bonfire_id,
    agentId: config.agent_id,
  });

  const gameKG = new GameKG({
    sdk,
    manifestPath: path.join(modDir, 'game-kg-manifest.json'),
    bonfireId: config.bonfire_id,
  });

  const kg = new KGContext(sdk, { gameKG });

  // ========================================================
  // STACK PUSH — Rich context from ai_rpg state
  // ========================================================

  // Poll chatHistory for new messages and push to stack + Matrix + GameKG
  let lastChatHistoryLength = 0;
  let lastTrackedPlayerCount = 0;
  let lastTrackedLocationCount = 0;
  let lastTrackedThingCount = 0;

  setInterval(() => {
    const history = scope.chatHistory || [];
    if (history.length <= lastChatHistoryLength) return;

    // Process new messages since last check
    const newMessages = history.slice(lastChatHistoryLength);
    lastChatHistoryLength = history.length;

    // Find the latest user + assistant pair
    let lastUser = null;
    let lastAssistant = null;
    for (const msg of newMessages) {
      if (msg.role === 'user') lastUser = msg;
      if (msg.role === 'assistant') lastAssistant = msg;
    }

    if (lastUser || lastAssistant) {
      pushToStack(
        lastUser ? { playerMessage: lastUser.content } : {},
        lastAssistant ? lastAssistant.content : ''
      );
    }

    // Track new game objects for KG CRUD
    trackNewGameObjects();

  }, 2000); // Check every 2 seconds

  function trackNewGameObjects() {
    // Track new players/NPCs
    if (players.size > lastTrackedPlayerCount) {
      for (const [id, player] of players) {
        if (!gameKG.isTracked(id)) {
          const type = player.isNPC ? 'npc' : 'player';
          gameKG.trackEntity(type, {
            gameId: id,
            name: player.name,
            description: player.description || '',
            labels: [player.race, player.class].filter(Boolean),
            attributes: { level: player.level, locationId: player.currentLocation },
          });

          // Structural edges
          const locId = player.currentLocation;
          const loc = gameLocations.get(locId);
          if (loc?.name) {
            gameKG.trackEdge(player.name, loc.name, 'LOCATED_AT', `${player.name} is at ${loc.name}`);
          }
        }
      }
      lastTrackedPlayerCount = players.size;
    }

    // Track new locations
    if (gameLocations.size > lastTrackedLocationCount) {
      for (const [id, loc] of gameLocations) {
        if (!gameKG.isTracked(id) && loc.name) {
          gameKG.trackEntity('location', {
            gameId: id,
            name: loc.name,
            description: loc.description || '',
            attributes: { regionId: loc.regionId },
          });

          // PART_OF region edge
          if (loc.regionId) {
            const region = regions.get(loc.regionId);
            if (region?.name) {
              gameKG.trackEdge(loc.name, region.name, 'PART_OF', `${loc.name} is in ${region.name}`);
            }
          }
        }
      }
      lastTrackedLocationCount = gameLocations.size;
    }

    // Track new things (items/scenery)
    if (things.size > lastTrackedThingCount) {
      for (const [id, thing] of things) {
        if (!gameKG.isTracked(id) && thing.name) {
          const type = thing.isScenery ? 'scenery' : 'item';
          gameKG.trackEntity(type, {
            gameId: id,
            name: thing.name,
            description: thing.description || '',
            labels: [thing.category].filter(Boolean),
            attributes: { rarity: thing.rarity },
          });
        }
      }
      lastTrackedThingCount = things.size;
    }

    // Track new regions
    for (const [id, region] of regions) {
      if (!gameKG.isTracked(id) && region.name) {
        gameKG.trackEntity('region', {
          gameId: id,
          name: region.name,
          description: region.description || '',
        });
      }
    }

    // Track new factions
    for (const [id, faction] of factions) {
      if (!gameKG.isTracked(id) && faction.name) {
        gameKG.trackEntity('faction', {
          gameId: id,
          name: faction.name,
          description: faction.description || '',
        });
      }
    }

    // Flush if anything is pending
    if (gameKG.pendingCount > 0) {
      // Flush with world-time context
      const Globals = require('../../Globals');
      const worldTimeCtx = Globals.getWorldTimeContext?.() || {};
      const worldTimeMinutes = Globals.getTotalWorldMinutes?.() || null;
      gameKG.flush({
        worldTime: worldTimeCtx.formatted || worldTimeCtx.time || null,
        worldTimeMinutes,
      }).catch(err => console.warn('[game-kg] Flush failed:', err.message));
    }
  }

  async function pushToStack(requestBody, aiResponseOverride) {
    const playerMessage = requestBody?.playerMessage || '';
    if (!playerMessage) return;

    const player = scope.currentPlayer;
    if (!player) return;

    const locationId = player.currentLocation;
    const location = locationId ? gameLocations.get(locationId) : null;
    const region = location ? scope.findRegionByLocationId?.(locationId) : null;

    // Build rich context summary
    const parts = [`[${config.player_name || player.name}]`];

    if (region) parts.push(`Region: ${region.name}`);
    if (location) parts.push(`Location: ${location.name}`);

    // NPCs present
    const npcIds = location?.npcIds || [];
    if (npcIds.length > 0) {
      const npcNames = npcIds
        .map(id => players.get(id))
        .filter(n => n && n.isNPC && !n.isDead)
        .map(n => `${n.name} (${n.class || 'unknown'}, L${n.level})`)
        .slice(0, 5);
      if (npcNames.length) parts.push(`NPCs present: ${npcNames.join(', ')}`);
    }

    // Player state
    parts.push(`HP: ${player.health}/${player.maxHealth}, Level: ${player.level}`);

    // Active quests
    const questList = player.quests || [];
    const activeQuests = questList.filter(q => !q.isComplete).slice(0, 3);
    if (activeQuests.length) {
      parts.push(`Quests: ${activeQuests.map(q => q.name).join(', ')}`);
    }

    // Combat state
    if (player.inCombat) parts.push('IN COMBAT');

    // Key inventory
    const inv = player.inventory || [];
    if (inv.length > 0) {
      const keyItems = inv.slice(0, 5).map(t => t.name);
      parts.push(`Carrying: ${keyItems.join(', ')}`);
    }

    parts.push(`Action: ${playerMessage}`);
    const userText = parts.join(' | ');

    // Get narrator response — full text for Matrix, truncated for stack
    let aiResponseFull = '';
    if (aiResponseOverride && typeof aiResponseOverride === 'string') {
      aiResponseFull = aiResponseOverride;
    } else {
      const history = scope.chatHistory || [];
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i]?.role === 'assistant') {
          aiResponseFull = history[i].content || '';
          break;
        }
      }
    }

    const now = new Date().toISOString();
    const chatId = `airpg-${config.agent_id}`;

    try {
      await sdk.agents.stackAdd([
        { text: userText, userId: 'game-player', chatId, timestamp: now, role: 'user' },
        { text: aiResponseFull || 'Action processed.', userId: `agent:${config.agent_id}`, chatId, timestamp: now, role: 'assistant' },
      ], { paired: true });
    } catch (err) {
      console.error('[bonfires-gm] Stack push failed:', err.message);
    }

    // Post FULL narration to Matrix location room
    const matrixNarrator = scope.matrixNarrator;
    if (matrixNarrator && locationId && location?.name) {
      const locationName = location.name;
      const pName = config.player_name || player.name || 'Player';

      // Post player action and full AI response as separate messages
      matrixNarrator.postNarration('default', locationId, locationName,
        `**[${pName}]** ${playerMessage}`
      ).catch(err => console.warn('[bonfires-gm] Matrix player action post failed:', err.message));

      if (aiResponseFull) {
        matrixNarrator.postNarration('default', locationId, locationName,
          aiResponseFull
        ).catch(err => console.warn('[bonfires-gm] Matrix narration post failed:', err.message));
      }
    }
  }

  // ========================================================
  // HOST MODE — WS server + GM cron
  // ========================================================

  let wsServer = null;
  let gmCronInterval = null;
  const connectedClients = new Map();

  if (config.is_host) {
    const port = config.host_port || 9998;
    wsServer = new WebSocket.Server({ port });
    console.log(`[bonfires-gm] HOST — WS :${port}`);

    wsServer.on('connection', (ws) => {
      let clientAgentId = null;

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'register') {
            clientAgentId = msg.agent_id;
            connectedClients.set(clientAgentId, ws);
            console.log(`[bonfires-gm] Client: ${clientAgentId}`);
            ws.send(JSON.stringify({ type: 'registered', agent_id: clientAgentId }));
          }
          if (msg.type === 'action_summary' && clientAgentId) {
            broadcastToOthers(clientAgentId, {
              type: 'player_action', agent_id: clientAgentId, summary: msg.summary,
            });
          }
        } catch (err) {
          console.error('[bonfires-gm] WS parse error:', err.message);
        }
      });

      ws.on('close', () => {
        if (clientAgentId) connectedClients.delete(clientAgentId);
      });
    });

    function broadcastToAll(event) {
      const json = JSON.stringify(event);
      for (const [, ws] of connectedClients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
      }
      handleWorldEvent(event); // Also apply locally
    }

    function broadcastToOthers(excludeId, event) {
      const json = JSON.stringify(event);
      for (const [id, ws] of connectedClients) {
        if (id !== excludeId && ws.readyState === WebSocket.OPEN) ws.send(json);
      }
    }

    // GM Cron
    gmCronInterval = setInterval(async () => {
      try {
        const result = await sdk.agents.stackProcess();
        const episodeId = result?.episode_id || result?.data?.episode_id;
        if (!episodeId) return;

        console.log(`[bonfires-gm] Episode: ${episodeId}`);

        const gmReaction = await sdk.agents.chat(
          'You are the Game Master for a shared multiplayer world. A new episode of player activity was just recorded. ' +
          'React to recent events and decide on world changes. Return strict JSON:\n' +
          '{"reaction": "narrative text describing what happens in the world",\n' +
          ' "world_events": ["public event description visible to all players"],\n' +
          ' "npc_spawns": [{"name": "NPC Name", "description": "appearance and role", "class": "warrior/mage/rogue/etc", "race": "human/elf/etc", "level": 5, "personality": "traits", "locationName": "where they appear", "isHostile": false}],\n' +
          ' "item_appearances": [{"name": "Item Name", "description": "what it is", "rarity": "common/uncommon/rare/legendary", "locationName": "where it appears", "slot": "weapon/armor/etc or null"}],\n' +
          ' "quest_hooks": [{"name": "Quest Name", "description": "what to do", "giver": "NPC name", "objectives": ["objective 1", "objective 2"]}],\n' +
          ' "faction_changes": [{"faction": "faction name", "event": "what happened"}]}',
          { graphMode: 'adaptive' }
        );

        const reply = gmReaction?.reply || '';
        const parsed = safeJsonParse(reply);

        if (parsed) {
          broadcastToAll({ type: 'gm_decision', decision: parsed, episode_id: episodeId });
        } else if (reply) {
          broadcastToAll({ type: 'gm_reaction', reaction: reply, episode_id: episodeId });
        }
      } catch (err) {
        console.error('[bonfires-gm] GM cron:', err.message);
      }
    }, config.gm_cron_interval_ms || 60000);
  }

  // ========================================================
  // CLIENT MODE
  // ========================================================

  let hostWs = null;

  if (!config.is_host && config.host_url) {
    function connectToHost() {
      hostWs = new WebSocket(config.host_url);
      hostWs.on('open', () => {
        console.log('[bonfires-gm] Connected to host');
        hostWs.send(JSON.stringify({ type: 'register', agent_id: config.agent_id }));
      });
      hostWs.on('message', (raw) => {
        try { handleWorldEvent(JSON.parse(raw.toString())); }
        catch (err) { console.error('[bonfires-gm] Parse:', err.message); }
      });
      hostWs.on('close', () => setTimeout(connectToHost, 3000));
      hostWs.on('error', () => {});
    }
    connectToHost();
  }

  // ========================================================
  // WORLD EVENT HANDLER
  // ========================================================

  function handleWorldEvent(event) {
    const type = event.type;
    if (!type) return;

    switch (type) {
      case 'gm_decision':
        applyGmDecision(event.decision || {});
        break;
      case 'gm_reaction':
        injectNarration(`[World] ${event.reaction || 'Something shifts...'}`);
        break;
      case 'player_action':
        if (event.agent_id !== config.agent_id) {
          injectNarration(`[Elsewhere] ${event.summary || 'Another adventurer acts.'}`);
        }
        break;
      case 'world_event':
        injectNarration(event.text || 'The world changes.');
        break;
    }
  }

  function injectNarration(text) {
    if (Array.isArray(scope.chatHistory)) {
      scope.chatHistory.push({
        role: 'system', content: text,
        isWorldEvent: true, timestamp: new Date().toISOString(),
      });
    }
    realtimeHub.broadcast({ type: 'world_event', payload: { text, timestamp: Date.now() } });
  }

  // ========================================================
  // APPLY GM DECISION — Create real ai_rpg objects
  // ========================================================

  function applyGmDecision(decision) {
    const reaction = decision.reaction || '';
    if (reaction) injectNarration(`[Game Master] ${reaction}`);

    // World events
    for (const text of decision.world_events || []) {
      injectNarration(`[World] ${text}`);
    }

    // NPC spawns — create actual Player objects
    for (const npcData of decision.npc_spawns || []) {
      try {
        spawnNpc(npcData);
      } catch (err) {
        console.error(`[bonfires-gm] NPC spawn failed (${npcData.name}):`, err.message);
        injectNarration(`[World] ${npcData.name || 'A figure'} appears: ${npcData.description || ''}`);
      }
    }

    // Item appearances — create actual Thing objects
    for (const itemData of decision.item_appearances || []) {
      try {
        spawnItem(itemData);
      } catch (err) {
        console.error(`[bonfires-gm] Item spawn failed (${itemData.name}):`, err.message);
        injectNarration(`[World] ${itemData.name || 'Something'} appears.`);
      }
    }

    // Quest hooks — create actual Quest objects
    for (const questData of decision.quest_hooks || []) {
      try {
        createQuest(questData);
      } catch (err) {
        console.error(`[bonfires-gm] Quest create failed (${questData.name}):`, err.message);
        injectNarration(`[Quest] ${questData.name || 'New quest'}: ${questData.description || ''}`);
      }
    }

    // Faction changes — narrate for now (faction system is complex)
    for (const change of decision.faction_changes || []) {
      injectNarration(`[Faction] ${change.faction}: ${change.event}`);
    }
  }

  function spawnNpc(data) {
    const name = data.name || 'Unknown';

    // Check if NPC already exists
    const existing = findActorByName?.(name);
    if (existing) {
      injectNarration(`[World] ${name} stirs and returns to the world.`);
      return;
    }

    // Find location to place NPC
    let location = null;
    if (data.locationName) {
      for (const [, loc] of gameLocations) {
        if (loc.name?.toLowerCase().includes(data.locationName.toLowerCase())) {
          location = loc;
          break;
        }
      }
    }
    // Fallback to current player's location
    if (!location && scope.currentPlayer?.currentLocation) {
      location = scope.currentPlayer.currentLocation;
    }

    const npc = new Player({
      name,
      description: data.description || `${name} appears in the world.`,
      shortDescription: data.shortDescription || '',
      class: data.class || 'citizen',
      race: data.race || 'human',
      level: data.level || (scope.currentPlayer?.level || 1),
      location: location?.id || null,
      isNPC: true,
      isHostile: Boolean(data.isHostile),
      personalityType: data.personality || null,
      personalityTraits: data.traits || null,
      goals: Array.isArray(data.goals) ? data.goals : null,
    });

    // Set level properly
    try { npc.setLevel(data.level || scope.currentPlayer?.level || 1); } catch {}

    // Register in game state
    players.set(npc.id, npc);

    // Add to location
    if (location && typeof location.addNpcId === 'function') {
      location.addNpcId(npc.id);
    }

    const where = location ? ` in ${location.name}` : '';
    injectNarration(`[World] ${name} appears${where}. ${data.description || ''}`);
    console.log(`[bonfires-gm] Spawned NPC: ${name} (${npc.id})${where}`);
  }

  function spawnItem(data) {
    const name = data.name || 'Unknown Item';

    // Find location
    let location = null;
    if (data.locationName) {
      for (const [, loc] of gameLocations) {
        if (loc.name?.toLowerCase().includes(data.locationName.toLowerCase())) {
          location = loc;
          break;
        }
      }
    }
    if (!location && scope.currentPlayer?.currentLocation) {
      location = scope.currentPlayer.currentLocation;
    }

    const thing = new Thing({
      name,
      description: data.description || `A ${data.rarity || 'mysterious'} item.`,
      shortDescription: data.shortDescription || null,
      thingType: 'item',
      rarity: data.rarity || null,
      slot: data.slot || null,
      level: data.level || (scope.currentPlayer?.level || 1),
    });

    // Register in game state
    things.set(thing.id, thing);

    // Add to location
    if (location) {
      Events.addThingToLocation(thing, location);
    }

    const where = location ? ` in ${location.name}` : '';
    injectNarration(`[World] ${name} materializes${where}. ${data.description || ''}`);
    console.log(`[bonfires-gm] Spawned item: ${name} (${thing.id})${where}`);
  }

  function createQuest(data) {
    const name = data.name || 'New Quest';
    const player = scope.currentPlayer;
    if (!player) return;

    const objectives = (data.objectives || []).map((desc, i) => ({
      id: `gm-quest-obj-${Date.now()}-${i}`,
      description: desc,
      isOptional: false,
      isComplete: false,
    }));

    const quest = new Quest({
      name,
      description: data.description || '',
      giver: data.giver || 'The World',
      objectives,
    });

    player.addQuest(quest);
    injectNarration(`[Quest Received] ${name}: ${data.description || ''}`);
    console.log(`[bonfires-gm] Quest added: ${name}`);
  }

  // ========================================================
  // KG CONTEXT — Same as before, SDK-direct
  // ========================================================

  setInterval(() => {
    kg.refresh(scope).catch(err =>
      console.error('[bonfires-gm] KG refresh:', err.message)
    );
  }, config.kg_refresh_interval_ms || 45000);

  kg.refresh(scope).catch(() => {});

  // Template globals
  promptEnv.addGlobal('getWorldEvents', (limit) => kg.getWorldEvents(limit));
  promptEnv.addGlobal('getRegionLore', () => kg.getRegionLore());
  promptEnv.addGlobal('getLocationFacts', (name) => kg.getLocationFacts(name));
  promptEnv.addGlobal('getNpcMemories', (npcName) => kg.getNpcMemories(npcName));
  promptEnv.addGlobal('getFactionIntel', () => kg.getFactionIntel());
  promptEnv.addGlobal('getProphecies', () => kg.getProphecies());
  promptEnv.addGlobal('getWorldKnowledge', () => kg.formatForPrompt());
  promptEnv.addGlobal('getRumors', () => (kg.cache.get('rumors')?.data || []));
  promptEnv.addGlobal('getDreamVisions', () => (kg.cache.get('dreams')?.data || []));
  promptEnv.addGlobal('getItemHistory', (n) => (kg.cache.get(`item:${n}`)?.data || []));
  promptEnv.addGlobal('getReputation', (n) => (kg.cache.get(`rep:${n}`)?.data || []));
  promptEnv.addGlobal('getWorldWhispers', () => {
    const events = kg.getWorldEvents(3);
    if (!events.length) return [];
    return events.map(e => {
      const s = e.summary || '';
      if (s.includes('defeat') || s.includes('slay')) return 'A distant roar falls silent.';
      if (s.includes('discover') || s.includes('found')) return 'Something old has been disturbed.';
      if (s.includes('quest')) return 'Somewhere, a bell tolls for a task begun.';
      return 'The world breathes differently today.';
    });
  });
  promptEnv.addGlobal('getDejaVu', (npcName) => {
    const m = kg.getNpcMemories(npcName);
    return m.length ? m[m.length - 1]?.summary || null : null;
  });
  promptEnv.addGlobal('getConvergenceHints', () => {
    const events = kg.getWorldEvents(10);
    const mentions = {};
    for (const e of events) {
      for (const w of (e.summary || '').toLowerCase().split(/\s+/)) {
        if (w.length > 5) mentions[w] = (mentions[w] || 0) + 1;
      }
    }
    const hot = Object.entries(mentions).filter(([, c]) => c >= 3).map(([w]) => w);
    return hot.length ? `Multiple forces drawn to "${hot.slice(0, 2).join('" and "')}"` : null;
  });

  // Refresh KG before each action
  app.use('/api/chat', async (req, res, next) => {
    if (req.method !== 'POST') return next();
    kg.refresh(scope).catch(() => {});
    next();
  });

  // ========================================================
  // MOD API ROUTES
  // ========================================================

  function registerConfigRoutes() {
    registerModRoute('post', '/configure', (req, res) => {
      const updates = req.body || {};
      for (const key of Object.keys(updates)) {
        if (key in config) config[key] = updates[key];
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      res.json({ success: true, config, note: 'Restart ai_rpg to apply.' });
    });
  }
  registerConfigRoutes();

  registerModRoute('get', '/status', (req, res) => {
    res.json({
      mode: config.is_host ? 'host' : 'client',
      connected: config.is_host ? true : hostWs?.readyState === WebSocket.OPEN,
      clients: config.is_host ? connectedClients.size : 0,
      bonfire_id: config.bonfire_id,
      agent_id: config.agent_id,
      kg_cache_size: kg.cache.size,
    });
  });

  registerModRoute('get', '/kg', async (req, res) => {
    try {
      res.json(await sdk.kg.search(req.query.q || 'world', { limit: parseInt(req.query.limit) || 10 }));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  registerModRoute('get', '/kg/context', (req, res) => {
    res.json({
      worldEvents: kg.getWorldEvents(),
      regionLore: kg.getRegionLore(),
      factionIntel: kg.getFactionIntel(),
      prophecies: kg.getProphecies(),
      npcMemories: Object.fromEntries(kg.npcMemories),
      formatted: kg.formatForPrompt(),
    });
  });

  registerModRoute('post', '/process-now', async (req, res) => {
    try { res.json(await sdk.agents.stackProcess()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  const mode = config.is_host ? `HOST (:${config.host_port || 9998})` : `CLIENT → ${config.host_url}`;
  console.log(`[bonfires-gm] ${mode} | SDK → ${config.delve_base_url}`);
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

module.exports = { register };
