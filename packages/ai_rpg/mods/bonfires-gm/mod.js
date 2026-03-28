/**
 * Bonfires GM Mod — Networks ai_rpg instances through a shared Bonfires stack.
 *
 * After each player action, pushes a summary to the agent's Bonfires stack.
 * A cron processes stacks periodically → creates episodes → triggers GM
 * decisions → world changes broadcast to all connected clients via WS.
 */

const { GMClient } = require('./gm-client');
const { WSBridge } = require('./ws-bridge');
const path = require('path');
const fs = require('fs');

function register(scope) {
  const { app, realtimeHub, modDir, registerModRoute } = scope;

  const configPath = path.join(modDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  if (!config.bonfire_id || !config.agent_id) {
    console.log('[bonfires-gm] Not configured — set bonfire_id and agent_id in config.json');
    registerConfigRoutes();
    return;
  }

  const gm = new GMClient(config);
  let wsBridge = null;
  let syncInterval = null;

  // ===== STACK: Push action summaries after each /api/chat =====

  // Wrap response to capture action results
  const originalUse = app.use;
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

    // Build a rich summary for the stack
    const userText = `[${playerName} at ${location?.name || 'unknown'}] ${playerMessage}`;

    // Get the AI response from chat history (last assistant message)
    let aiResponse = '';
    if (scope.chatHistory?.length > 0) {
      const last = scope.chatHistory[scope.chatHistory.length - 1];
      if (last?.role === 'assistant') {
        aiResponse = (last.content || '').slice(0, 500);
      }
    }

    const agentText = aiResponse
      ? `[Narrator for ${playerName}] ${aiResponse}`
      : `[${playerName}] Action processed.`;

    try {
      await gm.pushAction(userText);
    } catch (err) {
      console.error('[bonfires-gm] Action push failed:', err.message);
    }
  }

  // ===== CRON: Process stacks periodically =====

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

    console.log(`[bonfires-gm] Cron: process stack every ${config.sync_interval_ms / 1000}s`);
  }

  // ===== WS BRIDGE: Receive world events from GM server =====

  wsBridge = new WSBridge(config, {
    onWorldEvent: (event) => handleWorldEvent(event),
    onConnect: () => {
      console.log('[bonfires-gm] Connected to GM server');
      realtimeHub.broadcast({ type: 'bonfires_gm_status', payload: { connected: true } });
    },
    onDisconnect: () => {
      realtimeHub.broadcast({ type: 'bonfires_gm_status', payload: { connected: false } });
    },
  });
  wsBridge.connect();

  // ===== WORLD EVENTS → Local game narration =====

  function handleWorldEvent(event) {
    const type = event.type || event.event_type;
    const payload = event.payload || event;

    // Skip own events
    if (payload.agent_id === config.agent_id || payload.sender_agent_id === config.agent_id) return;

    let text = null;

    switch (type) {
      case 'room_message':
        text = payload.text || '';
        break;
      case 'player_joined':
        text = 'Another adventurer arrives nearby.';
        break;
      case 'player_left':
        text = 'An adventurer departs the area.';
        break;
      case 'gm_reaction':
        text = `[World] ${payload.reaction || payload.text || 'Something shifts in the world...'}`;
        break;
      case 'npc_spawned':
        text = `[World] ${payload.name || 'A figure'} has appeared.`;
        break;
      case 'room_updated':
        text = '[World] The surroundings change...';
        break;
      case 'object_created':
        text = `[World] ${payload.name || 'Something'} materializes nearby.`;
        break;
    }

    if (text) {
      injectNarration(text);
    }
  }

  function injectNarration(text) {
    // Push to chat history
    if (Array.isArray(scope.chatHistory)) {
      scope.chatHistory.push({
        role: 'system',
        content: text,
        isWorldEvent: true,
        timestamp: new Date().toISOString(),
      });
    }
    // Notify UI
    realtimeHub.broadcast({ type: 'world_event', payload: { text, timestamp: Date.now() } });
  }

  // ===== MOD API ROUTES =====

  function registerConfigRoutes() {
    registerModRoute('post', '/configure', (req, res) => {
      const updates = req.body || {};
      for (const key of ['bonfire_id', 'agent_id', 'player_name', 'gm_server_url', 'sync_interval_ms', 'auto_sync']) {
        if (updates[key] !== undefined) config[key] = updates[key];
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      res.json({ success: true, config, note: 'Restart ai_rpg to apply changes.' });
    });
  }

  registerConfigRoutes();

  registerModRoute('get', '/status', (req, res) => {
    res.json({
      connected: wsBridge?.ws?.readyState === 1, // WebSocket.OPEN
      bonfire_id: config.bonfire_id,
      agent_id: config.agent_id,
      player_name: config.player_name,
    });
  });

  registerModRoute('get', '/world', async (req, res) => {
    const map = await gm.getWorldMap();
    res.json(map || { error: 'unreachable' });
  });

  registerModRoute('get', '/feed', async (req, res) => {
    const feed = await gm.getFeed();
    res.json(feed || { error: 'unreachable' });
  });

  registerModRoute('post', '/process-now', async (req, res) => {
    const result = await gm.processStack();
    res.json(result || { error: 'processing failed' });
  });

  console.log('[bonfires-gm] Mod loaded — stack push + cron + WS bridge');
}

module.exports = { register };
