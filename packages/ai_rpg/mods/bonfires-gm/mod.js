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
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

function register(scope) {
  const { app, realtimeHub, modDir, registerModRoute, nunjucks } = scope;

  const configPath = path.join(modDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  if (!config.bonfire_id || !config.agent_id) {
    console.log('[bonfires-gm] Not configured — set bonfire_id, agent_id, delve_api_key in config.json');
    registerConfigRoutes();
    return;
  }

  // --- SDK client (talks directly to Delve, no proxy) ---
  const sdk = new BonfiresClient({
    baseUrl: config.delve_base_url,
    apiKey: config.delve_api_key,
    bonfireId: config.bonfire_id,
    agentId: config.agent_id,
  });

  const kg = new KGContext(sdk);

  // ========================================================
  // STACK PUSH — After each /api/chat, push to Delve directly
  // ========================================================

  app.use('/api/chat', (req, res, next) => {
    if (req.method !== 'POST') return next();
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      setImmediate(() => pushToStack(req.body));
      return originalJson(data);
    };
    next();
  });

  async function pushToStack(requestBody) {
    const playerMessage = requestBody?.playerMessage || '';
    if (!playerMessage) return;

    const player = scope.currentPlayer;
    const location = player?.currentLocation;
    const region = location?.region;
    const playerName = config.player_name || player?.name || 'Player';

    // Rich context for the stack
    const userText = [
      `[${playerName}]`,
      region ? `Region: ${region.name}` : '',
      location ? `Location: ${location.name}` : '',
      `Action: ${playerMessage}`,
    ].filter(Boolean).join(' | ');

    // Get narrator response
    let aiResponse = '';
    if (scope.chatHistory?.length > 0) {
      for (let i = scope.chatHistory.length - 1; i >= 0; i--) {
        if (scope.chatHistory[i]?.role === 'assistant') {
          aiResponse = (scope.chatHistory[i].content || '').slice(0, 500);
          break;
        }
      }
    }

    const now = new Date().toISOString();
    const chatId = `airpg-${config.agent_id}`;

    try {
      await sdk.agents.stackAdd([
        { text: userText, userId: 'game-player', chatId, timestamp: now, role: 'user' },
        { text: aiResponse || 'Action processed.', userId: `agent:${config.agent_id}`, chatId, timestamp: now, role: 'assistant' },
      ], { paired: true });
    } catch (err) {
      console.error('[bonfires-gm] Stack push failed:', err.message);
    }
  }

  // ========================================================
  // HOST MODE — WS server + GM cron
  // ========================================================

  let wsServer = null;
  let gmCronInterval = null;
  const connectedClients = new Map(); // agentId → ws

  if (config.is_host) {
    const port = config.host_port || 9998;

    wsServer = new WebSocket.Server({ port });
    console.log(`[bonfires-gm] HOST MODE — WS server on :${port}`);

    wsServer.on('connection', (ws) => {
      let clientAgentId = null;

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          if (msg.type === 'register') {
            clientAgentId = msg.agent_id;
            connectedClients.set(clientAgentId, ws);
            console.log(`[bonfires-gm] Client registered: ${clientAgentId}`);
            ws.send(JSON.stringify({ type: 'registered', agent_id: clientAgentId }));
          }

          if (msg.type === 'action_summary' && clientAgentId) {
            // Broadcast other players' actions to everyone else
            broadcastToOthers(clientAgentId, {
              type: 'player_action',
              agent_id: clientAgentId,
              summary: msg.summary,
            });
          }
        } catch (err) {
          console.error('[bonfires-gm] WS parse error:', err.message);
        }
      });

      ws.on('close', () => {
        if (clientAgentId) {
          connectedClients.delete(clientAgentId);
          console.log(`[bonfires-gm] Client disconnected: ${clientAgentId}`);
        }
      });
    });

    function broadcastToAll(event) {
      const json = JSON.stringify(event);
      for (const [, ws] of connectedClients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
      }
      // Also broadcast locally
      handleWorldEvent(event);
    }

    function broadcastToOthers(excludeAgentId, event) {
      const json = JSON.stringify(event);
      for (const [agentId, ws] of connectedClients) {
        if (agentId !== excludeAgentId && ws.readyState === WebSocket.OPEN) {
          ws.send(json);
        }
      }
    }

    // GM Cron — process stacks and trigger GM decisions
    gmCronInterval = setInterval(async () => {
      try {
        // Process host agent's stack
        const result = await sdk.agents.stackProcess();
        if (result?.episode_id || result?.data?.episode_id) {
          const episodeId = result.episode_id || result.data?.episode_id;
          console.log(`[bonfires-gm] Episode created: ${episodeId}`);

          // Get GM reaction via agent chat
          const gmReaction = await sdk.agents.chat(
            `You are the Game Master for a shared world. A new episode has been created (${episodeId}). ` +
            `React to recent events and decide on world changes. Return JSON with: ` +
            `{"reaction": "narrative", "world_events": ["event for all players"], ` +
            `"npc_spawns": [{"name", "description", "locationName", "personality"}], ` +
            `"quest_hooks": [{"name", "description", "objectives": []}]}`,
            { graphMode: 'adaptive' }
          );

          const reply = gmReaction?.reply || '';
          const parsed = safeJsonParse(reply);

          if (parsed) {
            broadcastToAll({
              type: 'gm_decision',
              decision: parsed,
              episode_id: episodeId,
            });
          } else if (reply) {
            broadcastToAll({
              type: 'gm_reaction',
              reaction: reply,
              episode_id: episodeId,
            });
          }
        }
      } catch (err) {
        console.error('[bonfires-gm] GM cron failed:', err.message);
      }
    }, config.gm_cron_interval_ms || 60000);
  }

  // ========================================================
  // CLIENT MODE — Connect WS to host
  // ========================================================

  let hostWs = null;

  if (!config.is_host && config.host_url) {
    function connectToHost() {
      hostWs = new WebSocket(config.host_url);

      hostWs.on('open', () => {
        console.log('[bonfires-gm] Connected to host');
        hostWs.send(JSON.stringify({
          type: 'register',
          agent_id: config.agent_id,
          wallet: config.wallet || '',
        }));
      });

      hostWs.on('message', (raw) => {
        try {
          const event = JSON.parse(raw.toString());
          handleWorldEvent(event);
        } catch (err) {
          console.error('[bonfires-gm] Host message parse error:', err.message);
        }
      });

      hostWs.on('close', () => {
        console.log('[bonfires-gm] Disconnected from host, reconnecting...');
        setTimeout(connectToHost, 3000);
      });

      hostWs.on('error', () => {});
    }

    connectToHost();
  }

  // ========================================================
  // WORLD EVENT HANDLER — Applied in both modes
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
          injectNarration(`[Elsewhere] ${event.summary || 'Another adventurer acts...'}`);
        }
        break;
      case 'world_event':
        injectNarration(event.text || 'The world changes...');
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
  // APPLY GM DECISION — Create regions/NPCs/items natively
  // ========================================================

  async function applyGmDecision(decision) {
    const reaction = decision.reaction || '';
    if (reaction) {
      injectNarration(`[Game Master] ${reaction}`);
    }

    // World events — narrative text for all players
    const worldEvents = decision.world_events || [];
    for (const text of worldEvents) {
      injectNarration(`[World] ${text}`);
    }

    // NPC spawns — create via ai_rpg's scope if available
    const npcSpawns = decision.npc_spawns || [];
    for (const npc of npcSpawns) {
      injectNarration(`[World] ${npc.name || 'A figure'} arrives: ${npc.description || ''}`);
      // TODO: Use scope to create actual NPC via ai_rpg's Player class
      // This requires deeper integration with ai_rpg's object system
    }

    // Quest hooks — inject as narration for now
    const questHooks = decision.quest_hooks || [];
    for (const quest of questHooks) {
      injectNarration(`[Quest Available] ${quest.name || 'New quest'}: ${quest.description || ''}`);
      // TODO: Create actual Quest via scope
    }

    // Item appearances
    const items = decision.item_appearances || [];
    for (const item of items) {
      injectNarration(`[World] ${item.name || 'Something'} appears: ${item.description || ''}`);
      // TODO: Create actual Thing via scope
    }
  }

  // ========================================================
  // KG CONTEXT — Same as before, now using SDK directly
  // ========================================================

  setInterval(() => {
    kg.refresh(scope).catch(err =>
      console.error('[bonfires-gm] KG refresh failed:', err.message)
    );
  }, config.kg_refresh_interval_ms || 45000);

  kg.refresh(scope).catch(() => {});

  // Template globals (same as before)
  nunjucks.addGlobal('getWorldEvents', (limit) => kg.getWorldEvents(limit));
  nunjucks.addGlobal('getRegionLore', () => kg.getRegionLore());
  nunjucks.addGlobal('getLocationFacts', (name) => kg.getLocationFacts(name));
  nunjucks.addGlobal('getNpcMemories', (npcName) => kg.getNpcMemories(npcName));
  nunjucks.addGlobal('getFactionIntel', () => kg.getFactionIntel());
  nunjucks.addGlobal('getProphecies', () => kg.getProphecies());
  nunjucks.addGlobal('getWorldKnowledge', () => kg.formatForPrompt());
  nunjucks.addGlobal('getRumors', () => { const e = kg.cache.get('rumors'); return e?.data || []; });
  nunjucks.addGlobal('getDreamVisions', () => { const e = kg.cache.get('dreams'); return e?.data || []; });
  nunjucks.addGlobal('getItemHistory', (n) => { const e = kg.cache.get(`item:${n}`); return e?.data || []; });
  nunjucks.addGlobal('getReputation', (n) => { const e = kg.cache.get(`rep:${n}`); return e?.data || []; });
  nunjucks.addGlobal('getWorldWhispers', () => {
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
  nunjucks.addGlobal('getDejaVu', (npcName) => {
    const m = kg.getNpcMemories(npcName);
    return m.length ? m[m.length - 1]?.summary || null : null;
  });
  nunjucks.addGlobal('getConvergenceHints', () => {
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
        if (config.hasOwnProperty(key)) config[key] = updates[key];
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
    const query = req.query.q || 'world state';
    try {
      const result = await sdk.kg.search(query, { limit: parseInt(req.query.limit) || 10 });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
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
    try {
      const result = await sdk.agents.stackProcess();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
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
