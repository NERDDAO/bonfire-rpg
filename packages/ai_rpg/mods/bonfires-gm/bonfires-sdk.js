/**
 * Bonfires SDK for Node.js — direct Delve API access.
 * Ports the Python bonfire-cli SDK patterns to JS using axios.
 * No proxy server needed.
 */

const axios = require('axios');

class BonfiresClient {
  constructor({ baseUrl, apiKey, bonfireId, agentId } = {}) {
    this.baseUrl = (baseUrl || process.env.BONFIRE_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
    this.apiKey = apiKey || process.env.BONFIRE_API_KEY || '';
    this.bonfireId = bonfireId || process.env.BONFIRE_ID || '';
    this.agentId = agentId || process.env.BONFIRE_AGENT_ID || '';

    this.agents = new AgentsService(this);
    this.kg = new KGService(this);
  }

  async request(method, path, body = null, timeout = 30000) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    try {
      const res = await axios({
        method, url: `${this.baseUrl}${path}`,
        data: body, headers, timeout,
      });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.error || err.response?.data?.detail || err.message;
      throw new BonfiresError(`${method} ${path}: ${status || 'network'} — ${detail}`, status);
    }
  }
}

class BonfiresError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'BonfiresError';
    this.status = status;
  }
}

// --- Agents Service ---

class AgentsService {
  constructor(client) { this.c = client; }

  async chat(message, { agentId, chatHistory, graphMode, context } = {}) {
    const id = agentId || this.c.agentId;
    return this.c.request('POST', `/agents/${id}/chat`, {
      message,
      chat_history: chatHistory || [],
      graph_mode: graphMode || 'adaptive',
      context: context || {},
    });
  }

  async chatStream(message, { agentId } = {}) {
    const id = agentId || this.c.agentId;
    return this.c.request('POST', `/agents/${id}/chat/stream`, { message });
  }

  async stackAdd(messages, { agentId, paired = true } = {}) {
    const id = agentId || this.c.agentId;
    const body = Array.isArray(messages)
      ? { messages, is_paired: paired }
      : { message: messages };
    return this.c.request('POST', `/agents/${id}/stack/add`, body);
  }

  async stackProcess({ agentId } = {}) {
    const id = agentId || this.c.agentId;
    return this.c.request('POST', `/agents/${id}/stack/process`, {});
  }

  async stackStatus({ agentId } = {}) {
    const id = agentId || this.c.agentId;
    return this.c.request('GET', `/agents/${id}/stack/status`);
  }

  async getLatestEpisode({ agentId } = {}) {
    const id = agentId || this.c.agentId;
    return this.c.request('GET', `/agents/${id}/latest_episode`);
  }

  async list({ bonfireId } = {}) {
    const bid = bonfireId || this.c.bonfireId;
    return this.c.request('GET', `/agents?bonfire_id=${encodeURIComponent(bid)}`);
  }

  async get({ agentId } = {}) {
    const id = agentId || this.c.agentId;
    return this.c.request('GET', `/agents/${id}`);
  }
}

// --- Knowledge Graph Service ---

class KGService {
  constructor(client) { this.c = client; }

  async search(query, { bonfireId, limit = 10, centerNodeUuid, windowEnd } = {}) {
    const bid = bonfireId || this.c.bonfireId;
    const body = { bonfire_id: bid, query, num_results: limit };
    if (centerNodeUuid) body.center_node_uuid = centerNodeUuid;
    if (windowEnd) body.window_end = windowEnd;
    return this.c.request('POST', '/delve', body);
  }

  async getEntity(uuid, { bonfireId } = {}) {
    const bid = bonfireId || this.c.bonfireId;
    return this.c.request('GET', `/knowledge_graph/entity/${uuid}?bonfire_id=${encodeURIComponent(bid)}`);
  }

  async expandEntity(uuid, { bonfireId, limit = 20 } = {}) {
    const bid = bonfireId || this.c.bonfireId;
    return this.c.request('POST', '/knowledge_graph/expand/entity', {
      entity_uuid: uuid, bonfire_id: bid, limit,
    });
  }

  async createEntity({ name, bonfireId, labels = [], summary = '', attributes = {} } = {}) {
    const bid = bonfireId || this.c.bonfireId;
    return this.c.request('POST', '/knowledge_graph/entity', {
      name, bonfire_id: bid, labels, summary, attributes,
    });
  }

  async updateEntity(uuid, { name, labels, summary, attributes, bonfireId } = {}) {
    const bid = bonfireId || this.c.bonfireId;
    return this.c.request('POST', `/knowledge_graph/entity/${encodeURIComponent(uuid)}/update`, {
      name, labels, summary, attributes, bonfire_id: bid,
    });
  }

  async createEdge({ sourceUuid, targetUuid, edgeName, fact, bonfireId } = {}) {
    const bid = bonfireId || this.c.bonfireId;
    return this.c.request('POST', '/knowledge_graph/edge', {
      source_uuid: sourceUuid, target_uuid: targetUuid,
      edge_name: edgeName, fact, bonfire_id: bid,
    });
  }

  async getEpisodes({ agentId, limit = 20 } = {}) {
    const aid = agentId || this.c.agentId;
    return this.c.request('GET', `/knowledge_graph/agents/${encodeURIComponent(aid)}/episodes/latest`);
  }

  async expandEpisodes(episodeUuids, { bonfireId, limit = 30 } = {}) {
    const bid = bonfireId || this.c.bonfireId;
    return this.c.request('POST', '/knowledge_graph/episodes/expand', {
      episode_uuids: episodeUuids,
      bonfire_id: bid,
      limit,
    });
  }
}

module.exports = { BonfiresClient, BonfiresError };
