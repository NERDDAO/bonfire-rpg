'use strict';

const fs = require('fs');
const path = require('path');

/**
 * GameKG — Tracks game objects as KG entities with structural edges.
 *
 * Collects entity/edge operations during gameplay, flushes in batch.
 * Append-only: death/destruction are status edges, never deletions.
 */
class GameKG {
  constructor({ sdk, manifestPath, bonfireId = 'default' }) {
    this.sdk = sdk;
    this.bonfireId = bonfireId;
    this.manifestPath = manifestPath || path.join(__dirname, 'game-kg-manifest.json');

    // Pending operations (flushed in batch)
    this.pending = {
      creates: [],  // { gameId, name, labels, summary, attributes }
      updates: [],  // { gameId, changes: { name?, labels?, summary?, attributes? } }
      edges: [],    // { sourceName, targetName, edgeName, fact }
    };

    // Known entities: gameId → { uuid, name, labels }
    this.knownEntities = new Map();

    // Name → gameId lookup for edge resolution
    this.nameIndex = new Map();

    this.loadManifest();
  }

  // ── Tracking (queue for batch flush) ──────────────────

  /**
   * Queue a new entity for creation.
   * Dedupes against knownEntities — skips if already tracked.
   */
  trackEntity(type, { gameId, name, description, summary, labels = [], attributes = {}, gameObject }) {
    if (!gameId || !name) return;
    if (this.knownEntities.has(gameId)) return; // already in KG
    if (this.pending.creates.some(c => c.gameId === gameId)) return; // already pending

    // Build labels from type + provided — sanitize for Neo4j (no spaces, hyphens, parens)
    const allLabels = [type, ...labels]
      .filter(Boolean)
      .map(l => l.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''))
      .filter(l => l.length > 0);

    this.pending.creates.push({
      gameId,
      name,
      summary: summary || description || '',
      labels: allLabels,
      attributes: { ...attributes, gameId, type },
      gameObject: gameObject || null, // reference to write kgUuid back onto
    });

    // Pre-register in name index for edge resolution
    this.nameIndex.set(name, gameId);
  }

  /**
   * Queue an update to an existing entity.
   */
  updateEntity(gameId, changes) {
    if (!gameId || !this.knownEntities.has(gameId)) return;
    this.pending.updates.push({ gameId, changes });
  }

  /**
   * Queue a status edge (append-only — never delete).
   * Used for death, destruction, consumption, etc.
   */
  markEntity(gameId, status, meta = {}) {
    if (!gameId) return;
    const known = this.knownEntities.get(gameId);
    if (!known) return;

    this.pending.edges.push({
      sourceName: known.name,
      targetName: null, // self-referential status
      edgeName: 'HAS_STATUS',
      fact: `${known.name} ${status}. ${meta.cause || ''}`.trim(),
      _sourceUuid: known.uuid,
      _status: status,
    });

    // Also update the entity attributes
    this.updateEntity(gameId, {
      attributes: { status, ...meta, statusAt: new Date().toISOString() },
    });
  }

  /**
   * Queue a structural edge between two entities (by name).
   */
  trackEdge(sourceName, targetName, edgeName, fact = '') {
    if (!sourceName || !targetName || !edgeName) return;
    this.pending.edges.push({ sourceName, targetName, edgeName, fact });
  }

  // ── Flush (batch push to KG) ──────────────────────────

  /**
   * Flush all pending operations to the KG in batch.
   * Returns summary of what was pushed.
   */
  async flush({ worldTime, worldTimeMinutes } = {}) {
    if (!this.sdk?.kg) return { created: 0, updated: 0, edges: 0 };

    const results = { created: 0, updated: 0, edges: 0, errors: [] };

    // World-time context for stamping entities
    const timeAttrs = {};
    if (worldTime) timeAttrs.worldTime = worldTime;
    if (worldTimeMinutes != null) timeAttrs.worldTimeMinutes = worldTimeMinutes;

    // 1. Create new entities
    for (const entity of this.pending.creates) {
      try {
        const response = await this.sdk.kg.createEntity({
          name: entity.name,
          labels: entity.labels,
          summary: entity.summary,
          attributes: { ...entity.attributes, ...timeAttrs },
        });

        const uuid = response?.uuid || response?.entity_uuid || null;
        if (uuid) {
          this.knownEntities.set(entity.gameId, {
            uuid,
            name: entity.name,
            labels: entity.labels,
          });
          this.nameIndex.set(entity.name, entity.gameId);
          // Write UUID back onto the game object for save persistence
          if (entity.gameObject) {
            entity.gameObject.kgUuid = uuid;
          }
          results.created++;
        }
      } catch (err) {
        console.warn(`[game-kg] Failed to create entity "${entity.name}":`, err.message);
        results.errors.push({ op: 'create', name: entity.name, error: err.message });
      }
    }

    // 2. Update existing entities
    for (const update of this.pending.updates) {
      const known = this.knownEntities.get(update.gameId);
      if (!known?.uuid) continue;

      try {
        await this.sdk.kg.updateEntity(known.uuid, {
          name: update.changes.name || known.name,
          labels: update.changes.labels || known.labels,
          summary: update.changes.summary,
          attributes: update.changes.attributes,
        });
        results.updated++;

        // Update local cache
        if (update.changes.name) {
          known.name = update.changes.name;
          this.nameIndex.set(update.changes.name, update.gameId);
        }
        if (update.changes.labels) known.labels = update.changes.labels;
      } catch (err) {
        console.warn(`[game-kg] Failed to update entity "${known.name}":`, err.message);
        results.errors.push({ op: 'update', name: known.name, error: err.message });
      }
    }

    // 3. Create edges
    for (const edge of this.pending.edges) {
      const sourceUuid = edge._sourceUuid || this._resolveUuid(edge.sourceName);
      const targetUuid = edge._status ? sourceUuid : this._resolveUuid(edge.targetName);

      if (!sourceUuid) {
        results.errors.push({ op: 'edge', msg: `Cannot resolve source: ${edge.sourceName}` });
        continue;
      }
      if (!targetUuid && !edge._status) {
        results.errors.push({ op: 'edge', msg: `Cannot resolve target: ${edge.targetName}` });
        continue;
      }

      try {
        await this.sdk.kg.createEdge({
          sourceUuid,
          targetUuid: targetUuid || sourceUuid,
          edgeName: edge.edgeName,
          fact: worldTime ? `${edge.fact} [${worldTime}]` : edge.fact,
        });
        results.edges++;
      } catch (err) {
        console.warn(`[game-kg] Failed to create edge ${edge.edgeName}:`, err.message);
        results.errors.push({ op: 'edge', edgeName: edge.edgeName, error: err.message });
      }
    }

    // Clear pending
    this.pending.creates = [];
    this.pending.updates = [];
    this.pending.edges = [];

    // Persist manifest
    this.saveManifest();

    if (results.created > 0 || results.updated > 0 || results.edges > 0) {
      console.log(`[game-kg] Flushed: ${results.created} created, ${results.updated} updated, ${results.edges} edges`);
    }

    return results;
  }

  // ── Lookup ─────────────────────────────────────────────

  getUuid(gameId) {
    return this.knownEntities.get(gameId)?.uuid || null;
  }

  getByName(name) {
    const gameId = this.nameIndex.get(name);
    return gameId ? this.knownEntities.get(gameId) : null;
  }

  isTracked(gameId) {
    return this.knownEntities.has(gameId);
  }

  get trackedCount() {
    return this.knownEntities.size;
  }

  get pendingCount() {
    return this.pending.creates.length + this.pending.updates.length + this.pending.edges.length;
  }

  // ── Manifest persistence ──────────────────────────────

  loadManifest() {
    try {
      const raw = fs.readFileSync(this.manifestPath, 'utf8');
      const data = JSON.parse(raw);
      if (data.entities) {
        for (const [gameId, info] of Object.entries(data.entities)) {
          this.knownEntities.set(gameId, info);
          if (info.name) this.nameIndex.set(info.name, gameId);
        }
      }
      console.log(`[game-kg] Loaded manifest: ${this.knownEntities.size} known entities`);
    } catch {
      // No manifest yet — fresh start
    }
  }

  saveManifest() {
    const data = {
      bonfireId: this.bonfireId,
      entities: Object.fromEntries(this.knownEntities),
      lastFlush: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(this.manifestPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.warn('[game-kg] Failed to save manifest:', err.message);
    }
  }

  // ── Internal ──────────────────────────────────────────

  _resolveUuid(name) {
    if (!name) return null;
    // Try name index → known entities
    const gameId = this.nameIndex.get(name);
    if (gameId) return this.knownEntities.get(gameId)?.uuid || null;
    // Try direct UUID lookup (if name looks like a UUID)
    if (name.includes('-') && name.length > 30) return name;
    return null;
  }
}

module.exports = { GameKG };
