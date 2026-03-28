/**
 * Bonfires GM Mod — Networks ai_rpg instances through shared world knowledge.
 *
 * Three layers:
 * 1. STACK: pushes player action summaries to Bonfires (no LLM call)
 * 2. CRON: processes stacks → episodes → GM decisions → world events
 * 3. KG CONTEXT: injects cross-player world knowledge into AI prompts
 *    so NPCs remember other players, regions reference shared lore,
 *    and the world feels alive across instances
 */

const { GMClient } = require('./gm-client');
const { WSBridge } = require('./ws-bridge');
const { KGContext } = require('./kg-context');
const path = require('path');
const fs = require('fs');

function register(scope) {
  const { app, realtimeHub, modDir, registerModRoute, nunjucks } = scope;

  const configPath = path.join(modDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  if (!config.bonfire_id || !config.agent_id) {
    console.log('[bonfires-gm] Not configured — set bonfire_id and agent_id in config.json');
    registerConfigRoutes();
    return;
  }

  const gm = new GMClient(config);
  const kg = new KGContext(gm);
  let wsBridge = null;
  let syncInterval = null;
  let kgRefreshInterval = null;

  // ========================================================
  // LAYER 1: STACK — Push action summaries (no LLM call)
  // ========================================================

  app.use('/api/chat', (req, res, next) => {
    if (req.method !== 'POST') return next();

    const originalJson = res.json.bind(res);
    res.json = function (data) {
      setImmediate(() => pushToStack(req.body, data));
      return originalJson(data);
    };
    next();
  });

  async function pushToStack(requestBody, responseData) {
    const playerMessage = requestBody?.playerMessage || '';
    if (!playerMessage) return;

    const player = scope.currentPlayer;
    const location = player?.currentLocation;
    const playerName = config.player_name || player?.name || 'Player';

    const userText = `[${playerName} at ${location?.name || 'unknown'}] ${playerMessage}`;

    let aiResponse = '';
    if (scope.chatHistory?.length > 0) {
      for (let i = scope.chatHistory.length - 1; i >= 0; i--) {
        if (scope.chatHistory[i]?.role === 'assistant') {
          aiResponse = (scope.chatHistory[i].content || '').slice(0, 500);
          break;
        }
      }
    }

    const agentText = aiResponse || `[${playerName}] Action processed.`;

    try {
      await gm.pushToStack(userText, agentText);
    } catch (err) {
      console.error('[bonfires-gm] Stack push failed:', err.message);
    }
  }

  // ========================================================
  // LAYER 2: CRON — Process stacks + WS bridge
  // ========================================================

  if (config.auto_sync && config.sync_interval_ms > 0) {
    syncInterval = setInterval(async () => {
      try {
        const result = await gm.processStack();
        if (result?.episode_id) {
          console.log(`[bonfires-gm] Episode created: ${result.episode_id}`);
        }
      } catch (err) {
        console.error('[bonfires-gm] Cron sync failed:', err.message);
      }
    }, config.sync_interval_ms);
  }

  // WS bridge for real-time world events
  wsBridge = new WSBridge(config, {
    onWorldEvent: (event) => handleWorldEvent(event),
    onConnect: () => {
      realtimeHub.broadcast({ type: 'bonfires_gm_status', payload: { connected: true } });
    },
    onDisconnect: () => {
      realtimeHub.broadcast({ type: 'bonfires_gm_status', payload: { connected: false } });
    },
  });
  wsBridge.connect();

  function handleWorldEvent(event) {
    const type = event.type || event.event_type;
    const payload = event.payload || event;

    if (payload.agent_id === config.agent_id || payload.sender_agent_id === config.agent_id) return;

    let text = null;
    switch (type) {
      case 'room_message': text = payload.text || ''; break;
      case 'player_joined': text = 'Another adventurer arrives nearby.'; break;
      case 'player_left': text = 'An adventurer departs the area.'; break;
      case 'gm_reaction': text = `[World] ${payload.reaction || 'Something shifts...'}`;  break;
      case 'npc_spawned': text = `[World] ${payload.name || 'A figure'} has appeared.`; break;
      case 'room_updated': text = '[World] The surroundings change...'; break;
      case 'object_created': text = `[World] ${payload.name || 'Something'} materializes.`; break;
    }
    if (text) injectNarration(text);
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
  // LAYER 3: KG CONTEXT — Inject world knowledge into prompts
  // ========================================================

  // Refresh KG context periodically
  kgRefreshInterval = setInterval(() => {
    kg.refresh(scope).catch(err =>
      console.error('[bonfires-gm] KG refresh failed:', err.message)
    );
  }, 45_000); // every 45s

  // Initial fetch
  kg.refresh(scope).catch(() => {});

  // --- Nunjucks template globals ---
  // These are available in ALL prompt templates as global functions

  // Recent world events from other players
  nunjucks.addGlobal('getWorldEvents', (limit) => kg.getWorldEvents(limit));

  // Lore about the current region from the KG
  nunjucks.addGlobal('getRegionLore', () => kg.getRegionLore());

  // Facts about a specific location
  nunjucks.addGlobal('getLocationFacts', (name) => kg.getLocationFacts(name));

  // Cross-player NPC memories
  nunjucks.addGlobal('getNpcMemories', (npcName) => kg.getNpcMemories(npcName));

  // Faction intelligence from the KG
  nunjucks.addGlobal('getFactionIntel', () => kg.getFactionIntel());

  // Prophecies and patterns across all players
  nunjucks.addGlobal('getProphecies', () => kg.getProphecies());

  // Full formatted KG context block (XML) for injection
  nunjucks.addGlobal('getWorldKnowledge', () => kg.formatForPrompt());

  // Rumors — what travelers and merchants are saying
  nunjucks.addGlobal('getRumors', () => {
    const entry = kg.cache.get('rumors');
    return entry?.data || [];
  });

  // --- Middleware: enrich /api/chat requests with KG context ---
  // Refresh KG before each player action so prompts have fresh data

  app.use('/api/chat', async (req, res, next) => {
    if (req.method !== 'POST') return next();
    try {
      await kg.refresh(scope);
    } catch {
      // Non-blocking — stale cache is better than no response
    }
    next();
  });

  // Pre-fetch rumors and dreams on location change
  app.use('/api/chat', async (req, res, next) => {
    if (req.method !== 'POST') return next();
    // Trigger async fetches for data that templates might need
    Promise.allSettled([
      kg.getRumors(),
      kg.getDreamContent(),
    ]).catch(() => {});
    next();
  });

  // ========================================================
  // LAYER 3b: UNREASONABLE INJECTIONS
  // ========================================================

  // DREAM SEQUENCES: When player rests/sleeps, inject distant world visions
  nunjucks.addGlobal('getDreamVisions', () => {
    const entry = kg.cache.get('dreams');
    return entry?.data || [];
  });

  // ITEM PROVENANCE: Objects carry history from their journey across players
  nunjucks.addGlobal('getItemHistory', (itemName) => {
    const entry = kg.cache.get(`item:${itemName}`);
    return entry?.data || [];
  });

  // REPUTATION ECHOES: What the world knows about an entity
  nunjucks.addGlobal('getReputation', (name) => {
    const entry = kg.cache.get(`rep:${name}`);
    return entry?.data || [];
  });

  // WORLD WHISPERS: Cryptic fragments from the KG that hint at
  // things happening elsewhere — injected into ambient narration
  nunjucks.addGlobal('getWorldWhispers', () => {
    const events = kg.getWorldEvents(3);
    if (events.length === 0) return [];
    // Transform events into cryptic whispers
    return events.map(e => {
      const summary = e.summary || '';
      // Deliberately obscure — the player gets hints, not facts
      if (summary.includes('defeat') || summary.includes('slay'))
        return 'A distant roar falls silent. Something powerful has ended.';
      if (summary.includes('discover') || summary.includes('found'))
        return 'The wind carries a scent you cannot place — something old has been disturbed.';
      if (summary.includes('trade') || summary.includes('merchant'))
        return 'The roads feel different today. Commerce shifts like sand.';
      if (summary.includes('quest') || summary.includes('mission'))
        return 'Somewhere, a bell tolls for a task begun.';
      return 'The world breathes differently today.';
    });
  });

  // DÉJÀ VU: When an NPC says something that echoes a past episode
  // from another player, flag it for the narrator
  nunjucks.addGlobal('getDejaVu', (npcName) => {
    const memories = kg.getNpcMemories(npcName);
    if (memories.length === 0) return null;
    const oldest = memories[memories.length - 1];
    return oldest?.summary || null;
  });

  // CONVERGENCE DETECTOR: Are multiple players heading toward
  // the same goal/location? Creates dramatic tension.
  nunjucks.addGlobal('getConvergenceHints', () => {
    const events = kg.getWorldEvents(10);
    // Look for patterns — multiple events mentioning the same place/entity
    const mentions = {};
    for (const e of events) {
      const words = (e.summary || '').toLowerCase().split(/\s+/);
      for (const w of words) {
        if (w.length > 5) mentions[w] = (mentions[w] || 0) + 1;
      }
    }
    const hot = Object.entries(mentions)
      .filter(([, count]) => count >= 3)
      .map(([word]) => word);
    return hot.length > 0
      ? `Multiple forces seem drawn to the same point. The names "${hot.slice(0, 2).join('" and "')}" echo across the land.`
      : null;
  });

  // ========================================================
  // MOD API ROUTES
  // ========================================================

  function registerConfigRoutes() {
    registerModRoute('post', '/configure', (req, res) => {
      const updates = req.body || {};
      for (const key of ['bonfire_id', 'agent_id', 'player_name', 'gm_server_url', 'sync_interval_ms', 'auto_sync']) {
        if (updates[key] !== undefined) config[key] = updates[key];
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      res.json({ success: true, config, note: 'Restart ai_rpg to apply.' });
    });
  }

  registerConfigRoutes();

  registerModRoute('get', '/status', (req, res) => {
    res.json({
      connected: wsBridge?.ws?.readyState === 1,
      bonfire_id: config.bonfire_id,
      agent_id: config.agent_id,
      kg_cache_size: kg.cache.size,
      world_events: kg.worldEvents.length,
      npc_memories: kg.npcMemories.size,
    });
  });

  registerModRoute('get', '/world', async (req, res) => {
    res.json(await gm.getWorldMap() || { error: 'unreachable' });
  });

  registerModRoute('get', '/feed', async (req, res) => {
    res.json(await gm.getFeed() || { error: 'unreachable' });
  });

  registerModRoute('get', '/kg', async (req, res) => {
    const query = req.query.q || 'world state';
    const result = await gm.delveSearch(query, parseInt(req.query.limit) || 10);
    res.json(result || { error: 'search failed' });
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
    res.json(await gm.processStack() || { error: 'failed' });
  });

  registerModRoute('post', '/kg/refresh', async (req, res) => {
    await kg.refresh(scope);
    res.json({ success: true, cache_size: kg.cache.size });
  });

  console.log('[bonfires-gm] Mod loaded — stack + cron + WS + KG context injection');
  console.log('[bonfires-gm] Template globals: getWorldEvents, getRegionLore, getNpcMemories,');
  console.log('[bonfires-gm]   getFactionIntel, getProphecies, getWorldWhispers, getDreamVisions,');
  console.log('[bonfires-gm]   getItemHistory, getReputation, getDejaVu, getConvergenceHints');
}

module.exports = { register };
