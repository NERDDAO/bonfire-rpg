/**
 * Knowledge Graph context provider.
 *
 * Pre-fetches and caches KG data, then injects it into the game's
 * template rendering context so Nunjucks prompts can reference
 * cross-player world state, NPC memories, lore, and prophecies.
 */

class KGContext {
  constructor(gmClient) {
    this.gm = gmClient;
    this.cache = new Map();
    this.cacheTTL = 60_000; // 1 minute
    this.worldEvents = [];
    this.worldLore = [];
    this.npcMemories = new Map(); // npcName → memories
    this.factionIntel = [];
    this.prophecies = [];
    this.itemProvenance = new Map(); // itemName → history
  }

  // --- Cache helpers ---

  async cached(key, fetcher) {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.ts < this.cacheTTL) {
      return entry.data;
    }
    try {
      const data = await fetcher();
      this.cache.set(key, { data, ts: Date.now() });
      return data;
    } catch (err) {
      console.error(`[kg-context] cache miss for ${key}:`, err.message);
      return entry?.data || null;
    }
  }

  // --- Refresh all context (called periodically or before prompts) ---

  async refresh(scope) {
    const player = scope.currentPlayer;
    const location = player?.currentLocation;
    const regionName = location?.region?.name || '';
    const locationName = location?.name || '';

    // Parallel fetch
    await Promise.allSettled([
      this.refreshWorldEvents(),
      this.refreshWorldLore(regionName),
      this.refreshLocationContext(locationName, regionName),
      this.refreshNpcMemories(scope),
      this.refreshFactionIntel(),
      this.refreshProphecies(),
    ]);
  }

  async refreshWorldEvents() {
    this.worldEvents = await this.cached('worldEvents', async () => {
      const episodes = await this.gm.getRecentEpisodes(15);
      return episodes.map(ep => ({
        summary: ep.summary || ep.name || '',
        timestamp: ep.created_at || ep.timestamp || '',
        agent: ep.agent_id || '',
      })).filter(e => e.summary);
    }) || [];
  }

  async refreshWorldLore(regionName) {
    if (!regionName) return;
    this.worldLore = await this.cached(`lore:${regionName}`, async () => {
      const result = await this.gm.delveSearch(`lore history of ${regionName}`, 8);
      if (!result) return [];
      const entities = result.entities || result.nodes || [];
      return entities.map(e => ({
        name: e.name || '',
        summary: e.summary || e.description || '',
        labels: e.labels || [],
      })).filter(e => e.summary);
    }) || [];
  }

  async refreshLocationContext(locationName, regionName) {
    if (!locationName) return;
    await this.cached(`location:${locationName}`, async () => {
      const result = await this.gm.delveSearch(`${locationName} ${regionName}`, 5);
      if (!result) return null;
      // Store as location-specific lore
      const facts = (result.edges || []).map(e => e.fact).filter(Boolean);
      this.cache.set(`locationFacts:${locationName}`, {
        data: facts,
        ts: Date.now(),
      });
      return result;
    });
  }

  async refreshNpcMemories(scope) {
    // Get NPCs at current location
    const location = scope.currentPlayer?.currentLocation;
    if (!location) return;

    const npcIds = location.npcIds || [];
    const players = scope.players;

    for (const npcId of npcIds.slice(0, 5)) {
      const npc = players?.get?.(npcId);
      if (!npc) continue;
      const npcName = npc.name || npcId;

      const memories = await this.cached(`npcMem:${npcName}`, async () => {
        const result = await this.gm.delveSearch(`${npcName} interactions memories`, 6);
        if (!result) return [];
        const episodes = result.episodes || [];
        return episodes.map(ep => ({
          summary: ep.summary || '',
          timestamp: ep.created_at || '',
        })).filter(e => e.summary);
      });

      if (memories) this.npcMemories.set(npcName, memories);
    }
  }

  async refreshFactionIntel() {
    this.factionIntel = await this.cached('factionIntel', async () => {
      const result = await this.gm.delveSearch('faction conflict alliance war trade', 8);
      if (!result) return [];
      const edges = result.edges || [];
      return edges.map(e => ({
        fact: e.fact || '',
        source: e.source_name || '',
        target: e.target_name || '',
        name: e.name || '',
      })).filter(e => e.fact);
    }) || [];
  }

  async refreshProphecies() {
    this.prophecies = await this.cached('prophecies', async () => {
      const result = await this.gm.delveSearch('prophecy destiny fate omen pattern recurring', 5);
      if (!result) return [];
      const entities = result.entities || result.nodes || [];
      return entities.map(e => ({
        name: e.name || '',
        summary: e.summary || '',
      })).filter(e => e.summary);
    }) || [];
  }

  // --- Query methods (used by templates via injected globals) ---

  // Recent events from other players (for player-action context)
  getWorldEvents(limit = 5) {
    return this.worldEvents.slice(0, limit);
  }

  // Lore about the current region (for region/location generation)
  getRegionLore() {
    return this.worldLore;
  }

  // Facts about a specific location
  getLocationFacts(locationName) {
    const entry = this.cache.get(`locationFacts:${locationName}`);
    return entry?.data || [];
  }

  // Cross-player memories for an NPC
  getNpcMemories(npcName) {
    return this.npcMemories.get(npcName) || [];
  }

  // Faction relationships and intel from the KG
  getFactionIntel() {
    return this.factionIntel;
  }

  // Prophecies / patterns detected across all players
  getProphecies() {
    return this.prophecies;
  }

  // Search for item history across all players
  async getItemProvenance(itemName) {
    return this.cached(`item:${itemName}`, async () => {
      const result = await this.gm.delveSearch(`${itemName} crafted found used traded`, 5);
      if (!result) return [];
      const episodes = result.episodes || [];
      return episodes.map(ep => ({
        summary: ep.summary || '',
        timestamp: ep.created_at || '',
      })).filter(e => e.summary);
    }) || [];
  }

  // Dream content — distant echoes from the world
  async getDreamContent() {
    return this.cached('dreams', async () => {
      const result = await this.gm.delveSearch('strange vision dream omen whisper ancient', 5);
      if (!result) return [];
      const entities = result.entities || result.nodes || [];
      return entities.map(e => e.summary).filter(Boolean).slice(0, 3);
    }) || [];
  }

  // Rumor mill — what travelers and merchants are saying
  async getRumors() {
    return this.cached('rumors', async () => {
      const result = await this.gm.delveSearch('rumor news discovery battle victory defeat', 8);
      if (!result) return [];
      const episodes = result.episodes || [];
      return episodes
        .map(ep => ep.summary || '')
        .filter(Boolean)
        .slice(0, 5)
        .map(s => s.length > 150 ? s.slice(0, 147) + '...' : s);
    }) || [];
  }

  // Reputation echoes — what the world knows about a specific entity
  async getReputation(name) {
    return this.cached(`rep:${name}`, async () => {
      const result = await this.gm.delveSearch(`${name} reputation known for`, 5);
      if (!result) return [];
      return (result.edges || []).map(e => e.fact).filter(Boolean);
    }) || [];
  }

  // Format all context as a block for injection into prompts
  formatForPrompt() {
    const sections = [];

    if (this.worldEvents.length > 0) {
      sections.push('<worldEvents>\n' +
        this.worldEvents.slice(0, 5).map(e =>
          `  <event>${e.summary}</event>`
        ).join('\n') +
        '\n</worldEvents>');
    }

    if (this.worldLore.length > 0) {
      sections.push('<worldLore>\n' +
        this.worldLore.slice(0, 5).map(e =>
          `  <lore name="${e.name}">${e.summary}</lore>`
        ).join('\n') +
        '\n</worldLore>');
    }

    if (this.factionIntel.length > 0) {
      sections.push('<factionIntelligence>\n' +
        this.factionIntel.slice(0, 4).map(e =>
          `  <intel>${e.fact}</intel>`
        ).join('\n') +
        '\n</factionIntelligence>');
    }

    if (this.prophecies.length > 0) {
      sections.push('<propheciesAndOmens>\n' +
        this.prophecies.slice(0, 3).map(e =>
          `  <prophecy name="${e.name}">${e.summary}</prophecy>`
        ).join('\n') +
        '\n</propheciesAndOmens>');
    }

    return sections.join('\n\n');
  }
}

module.exports = { KGContext };
