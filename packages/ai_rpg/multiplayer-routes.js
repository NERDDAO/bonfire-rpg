'use strict';

function registerMultiplayerRoutes(app, { multiplayerHub, roundManager, bonfireManager }) {

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

  // Send OOC message
  app.post('/api/mp/:bonfireId/ooc', (req, res) => {
    const { bonfireId } = req.params;
    const { playerId, text } = req.body;

    if (!playerId || !text) {
      return res.status(400).json({ error: 'playerId and text are required' });
    }

    multiplayerHub.broadcastOOC(bonfireId, playerId, text);
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
}

module.exports = { registerMultiplayerRoutes };
