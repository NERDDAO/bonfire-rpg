/**
 * HTTP client for the Bonfires GM server (quest game engine).
 * Sends player actions as episodes, receives world state changes.
 */

const axios = require('axios');

class GMClient {
  constructor(config) {
    this.baseUrl = config.gm_server_url || 'http://localhost:9997';
    this.bonfireId = config.bonfire_id || '';
    this.agentId = config.agent_id || '';
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}/game${path}`;
    try {
      const res = await axios({ method, url, data: body, timeout: 30000 });
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      console.error(`[bonfires-gm] ${method} ${path} failed: ${msg}`);
      return null;
    }
  }

  // Push player action to Bonfires via /agents/complete.
  // This calls the Bonfires agent (gets a narrator response) AND
  // automatically pushes paired messages to the stack as a side effect.
  // The cron then processes the stack into episodes.
  async pushAction(summary) {
    return this.request('POST', '/agents/complete', {
      agent_id: this.agentId,
      bonfire_id: this.bonfireId,
      message: summary,
    });
  }

  // Get the current world map (rooms, players, NPCs, objects)
  async getWorldMap() {
    return this.request('GET', `/map?bonfire_id=${encodeURIComponent(this.bonfireId)}`);
  }

  // Get game state (players, quests)
  async getGameState() {
    return this.request('GET', `/state?bonfire_id=${encodeURIComponent(this.bonfireId)}`);
  }

  // Get game details
  async getGameDetails() {
    return this.request('GET', `/details?bonfire_id=${encodeURIComponent(this.bonfireId)}`);
  }

  // Get activity feed
  async getFeed(limit = 20) {
    return this.request('GET', `/feed?bonfire_id=${encodeURIComponent(this.bonfireId)}&limit=${limit}`);
  }

  // Register this client as a player (if not already registered)
  async registerPlayer(wallet, purchaseId, purchaseTxHash, erc8004BonfireId = 1) {
    return this.request('POST', '/agents/register-purchase', {
      agent_id: this.agentId,
      bonfire_id: this.bonfireId,
      wallet_address: wallet,
      purchase_id: purchaseId,
      purchase_tx_hash: purchaseTxHash,
      erc8004_bonfire_id: erc8004BonfireId,
      episodes_requested: 100,
    });
  }

  // Restore existing player
  async restorePlayer(wallet) {
    return this.request('POST', '/player/restore', {
      wallet_address: wallet,
      bonfire_id: this.bonfireId,
    });
  }

  // Process stack to create an episode from accumulated messages
  async processStack() {
    return this.request('POST', '/agents/process-stack', {
      agent_id: this.agentId,
      bonfire_id: this.bonfireId,
    });
  }

  // Move player to a room on the GM server
  async moveToRoom(roomId) {
    return this.request('POST', '/move', {
      agent_id: this.agentId,
      room_id: roomId,
    });
  }
}

module.exports = { GMClient };
