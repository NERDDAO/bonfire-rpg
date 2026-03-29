'use strict';

class MultiplayerHub {
  constructor() {
    this.bonfires = new Map(); // bonfireId -> Map<playerId, playerInfo>
    this.sendFn = null;
  }

  setSendFn(fn) {
    this.sendFn = fn;
  }

  addPlayer(bonfireId, playerId, info = {}) {
    if (!this.bonfires.has(bonfireId)) {
      this.bonfires.set(bonfireId, new Map());
    }
    this.bonfires.get(bonfireId).set(playerId, {
      id: playerId,
      name: info.name || playerId,
      locationId: info.locationId || null,
      joinedAt: Date.now(),
    });
  }

  removePlayer(bonfireId, playerId) {
    const players = this.bonfires.get(bonfireId);
    if (players) {
      players.delete(playerId);
      if (players.size === 0) {
        this.bonfires.delete(bonfireId);
      }
    }
  }

  getPlayers(bonfireId) {
    const players = this.bonfires.get(bonfireId);
    if (!players) return [];
    return Array.from(players.values());
  }

  getPlayerCount(bonfireId) {
    const players = this.bonfires.get(bonfireId);
    return players ? players.size : 0;
  }

  getPlayersInLocation(bonfireId, locationId) {
    return this.getPlayers(bonfireId).filter(p => p.locationId === locationId);
  }

  updatePlayerLocation(bonfireId, playerId, locationId) {
    const players = this.bonfires.get(bonfireId);
    if (players && players.has(playerId)) {
      players.get(playerId).locationId = locationId;
    }
  }

  broadcastOOC(bonfireId, fromPlayerId, text) {
    const msg = { type: 'ooc_chat', from: fromPlayerId, text, timestamp: Date.now() };
    for (const player of this.getPlayers(bonfireId)) {
      this._send(player.id, msg);
    }
  }

  broadcastToLocation(bonfireId, locationId, payload) {
    for (const player of this.getPlayersInLocation(bonfireId, locationId)) {
      this._send(player.id, payload);
    }
  }

  broadcastToBonfire(bonfireId, payload) {
    for (const player of this.getPlayers(bonfireId)) {
      this._send(player.id, payload);
    }
  }

  _send(playerId, msg) {
    if (this.sendFn) {
      this.sendFn(playerId, msg);
    }
  }
}

module.exports = { MultiplayerHub };
