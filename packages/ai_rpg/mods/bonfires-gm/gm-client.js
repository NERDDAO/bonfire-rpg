/**
 * HTTP client for the Bonfires GM server (quest game engine).
 * Pushes player actions to the stack, processes episodes, reads world state.
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

  // Push paired messages directly to the Bonfires stack — NO LLM call.
  // Uses the engine's POST /game/agents/stack/add proxy which handles auth.
  async pushToStack(userText, agentText) {
    const now = new Date().toISOString();
    const chatId = `airpg-${this.agentId}`;
    return this.request('POST', '/agents/stack/add', {
      agent_id: this.agentId,
      messages: [
        { text: userText, userId: 'game-player', chatId, timestamp: now, role: 'user' },
        { text: agentText, userId: `agent:${this.agentId}`, chatId, timestamp: now, role: 'assistant' },
      ],
      is_paired: true,
    });
  }

  // Push a single message to the stack
  async pushMessage(text, role = 'user') {
    const now = new Date().toISOString();
    return this.request('POST', '/agents/stack/add', {
      agent_id: this.agentId,
      message: { text, userId: 'game-player', chatId: `airpg-${this.agentId}`, timestamp: now, role },
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

  // --- Knowledge Graph Queries (via Delve) ---

  // Search the KG for entities, episodes, and relationships
  async delveSearch(query, limit = 10) {
    const url = `${this.baseUrl.replace(/\/game$/, '')}/delve`;
    try {
      const res = await axios.post(url, {
        bonfire_id: this.bonfireId,
        query,
        limit,
      }, { timeout: 15000 });
      return res.data;
    } catch (err) {
      console.error(`[bonfires-gm] delve search failed: ${err.response?.data?.error || err.message}`);
      return null;
    }
  }

  // Get episodes for the bonfire (recent world events)
  async getRecentEpisodes(limit = 20) {
    const url = `${this.baseUrl.replace(/\/game$/, '')}/bonfires/${encodeURIComponent(this.bonfireId)}/episodes?limit=${limit}`;
    try {
      const res = await axios.get(url, { timeout: 10000 });
      return res.data?.episodes || [];
    } catch {
      return [];
    }
  }

  // Expand an entity to get its relationships
  async expandEntity(entityUuid) {
    const url = `${this.baseUrl.replace(/\/game$/, '')}/knowledge_graph/expand/entity`;
    try {
      const res = await axios.post(url, {
        entity_uuid: entityUuid,
        bonfire_id: this.bonfireId,
        limit: 20,
      }, { timeout: 10000 });
      return res.data;
    } catch {
      return null;
    }
  }
}

module.exports = { GMClient };

module.exports = { GMClient };
