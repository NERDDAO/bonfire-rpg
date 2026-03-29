'use strict';

function registerMultiplayerRoutes(app, { multiplayerHub, roundManager, bonfireManager, matrixNarrator }) {

  // Join a bonfire
  app.post('/api/mp/:bonfireId/join', (req, res) => {
    const { bonfireId } = req.params;
    const { playerId, playerName, locationId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    multiplayerHub.addPlayer(bonfireId, playerId, {
      name: playerName || playerId,
      locationId: locationId || null,
    });

    const roster = multiplayerHub.getPlayers(bonfireId);
    multiplayerHub.broadcastToBonfire(bonfireId, {
      type: 'roster_update',
      roster,
    });

    res.json({
      success: true,
      playerCount: multiplayerHub.getPlayerCount(bonfireId),
      roster,
    });
  });

  // Leave a bonfire
  app.post('/api/mp/:bonfireId/leave', (req, res) => {
    const { bonfireId } = req.params;
    const { playerId } = req.body;

    multiplayerHub.removePlayer(bonfireId, playerId);

    const roster = multiplayerHub.getPlayers(bonfireId);
    multiplayerHub.broadcastToBonfire(bonfireId, {
      type: 'roster_update',
      roster,
    });

    res.json({ success: true });
  });

  // Get roster
  app.get('/api/mp/:bonfireId/roster', (req, res) => {
    const { bonfireId } = req.params;
    res.json({
      roster: multiplayerHub.getPlayers(bonfireId),
      playerCount: multiplayerHub.getPlayerCount(bonfireId),
    });
  });

  // Send OOC message (proxied through bot to Matrix)
  app.post('/api/mp/:bonfireId/ooc', async (req, res) => {
    const { bonfireId } = req.params;
    const { playerId, playerName, text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const name = playerName || playerId || 'Anonymous';

    // Broadcast to in-game WebSocket clients
    multiplayerHub.broadcastOOC(bonfireId, playerId || 'anon', text);

    // Proxy to Matrix via bot (posts as bot with player name prefix)
    if (matrixNarrator) {
      const bonfire = matrixNarrator.bonfires.get(bonfireId);
      if (bonfire?.globalOOCRoomId) {
        matrixNarrator.client.sendMessage(bonfire.globalOOCRoomId, {
          msgtype: 'm.text',
          body: `[${name}] ${text}`,
          format: 'org.matrix.custom.html',
          formatted_body: `<strong>${matrixNarrator._esc(name)}</strong> ${matrixNarrator._esc(text)}`,
        }).catch(err => console.warn('[matrix] OOC proxy failed:', err.message));
      }
    }

    res.json({ success: true });
  });

  // Queue IC action (goes through RoundManager)
  app.post('/api/mp/:bonfireId/action', (req, res) => {
    const { bonfireId } = req.params;
    const { playerId, playerName, locationId, text } = req.body;

    if (!playerId || !locationId || !text) {
      return res.status(400).json({ error: 'playerId, locationId, and text are required' });
    }

    roundManager.queueAction(locationId, {
      playerId,
      playerName: playerName || playerId,
      bonfireId,
      text,
      timestamp: Date.now(),
    });

    const round = roundManager.getRound(locationId);
    res.json({
      success: true,
      roundActions: round ? round.actions.length : 0,
    });
  });

  // Get round status for a location
  app.get('/api/mp/:bonfireId/round/:locationId', (req, res) => {
    const { locationId } = req.params;
    const round = roundManager.getRound(locationId);
    res.json({
      active: !!round,
      actionCount: round ? round.actions.length : 0,
      startedAt: round ? round.startedAt : null,
    });
  });

  // Get Matrix room config for a bonfire (so frontend can connect)
  app.get('/api/mp/:bonfireId/matrix', (req, res) => {
    const { bonfireId } = req.params;
    if (!matrixNarrator) {
      return res.json({ enabled: false });
    }
    const bonfire = matrixNarrator.bonfires.get(bonfireId);
    if (!bonfire) {
      return res.json({ enabled: true, ready: false });
    }
    res.json({
      enabled: true,
      ready: true,
      homeserver: matrixNarrator.homeserverUrl,
      spaceId: bonfire.spaceId,
      globalOOCRoomId: bonfire.globalOOCRoomId,
      deathFeedRoomId: bonfire.deathFeedRoomId,
      locationRooms: Object.fromEntries(bonfire.locationRooms),
    });
  });
}

module.exports = { registerMultiplayerRoutes };
