# GameKG — KG CRUD for Game Objects

## Context

bonfire-rpg generates game objects (NPCs, locations, items, factions, regions) via LLM during gameplay. Currently these exist only in-memory Maps and FS saves. We want to persist them as KG entities in the Bonfires knowledge graph so the world becomes searchable, cross-session persistent, and enrichable by the episode pipeline.

Each play session gets a kEngram manifest tracking what was created. Session kEngrams merge into a bonfire-level topic kEngram over time.

## Data Model

### Entity Mappings

| Game Object | KG Labels | Summary Source | Key Attributes |
|-------------|-----------|----------------|----------------|
| Player (NPC) | `['npc', race, class]` | `player.description` | level, health, locationId |
| Player (PC) | `['player', race, class]` | `player.description` | level, health, locationId |
| Location | `['location']` | `location.description` | regionId |
| Region | `['region']` | `region.description` | — |
| Thing (item) | `['item', category]` | `thing.description` | ownerId, locationId, rarity |
| Thing (scenery) | `['scenery']` | `thing.description` | locationId |
| Faction | `['faction']` | `faction.description` | alignment |

### Structural Edges (created with entities)

| Source | Target | Edge | When |
|--------|--------|------|------|
| NPC/Player | Location | `LOCATED_AT` | On creation, on travel |
| Location | Region | `PART_OF` | On location generation |
| NPC | Faction | `ALLIED_WITH` | On NPC creation |
| Item | Player | `OWNED_BY` | On pickup/creation in inventory |
| Item | Location | `LOCATED_AT` | On drop / ground spawn |

### Event Edges (NOT from us — episode pipeline)

`KILLED_BY`, `LOOTED_FROM`, `TRADED_WITH`, `DISCOVERED_BY`, `COMPLETED_QUEST` — these emerge naturally from episode extraction on the stack messages. We don't duplicate them.

## Architecture

### GameKG Class

New file: `packages/ai_rpg/mods/bonfires-gm/game-kg.js`

```
GameKG
├── sdk: BonfiresClient              // for API calls
├── pending: { creates: [], updates: [], edges: [], removes: [] }
├── knownEntities: Map<gameId, { uuid, name, labels }>
├── sessionKEngramId: string
│
├── trackEntity(type, gameObj)       // queue CREATE
├── updateEntity(gameId, changes)    // queue UPDATE
├── removeEntity(gameId, meta)       // queue deactivation
├── trackEdge(srcName, tgtName, rel, fact)  // queue edge
│
├── flush()                          // batch push all pending to KG
├── getUuid(gameId)                  // lookup KG UUID
│
├── loadManifest()                   // load gameId→uuid map from disk
└── saveManifest()                   // persist to disk
```

### Manifest (persisted to disk)

File: `packages/ai_rpg/mods/bonfires-gm/game-kg-manifest.json`

```json
{
  "bonfireId": "default",
  "sessionKEngramId": "ke-2026-03-29-guard-barracks",
  "entities": {
    "player_123": { "uuid": "kg-uuid-abc", "name": "Corvus", "labels": ["npc", "human", "ranger"] },
    "location_456": { "uuid": "kg-uuid-def", "name": "Guard Barracks", "labels": ["location"] }
  },
  "lastFlush": "2026-03-29T04:30:00Z"
}
```

### Explicit Hooks (in bonfires-gm mod)

The mod already intercepts game events. Add `gameKG.track*()` calls at these points:

**On GM decision (applyGmDecision):**
- NPC spawned → `gameKG.trackEntity('npc', npc)` + `trackEdge(npc, location, 'LOCATED_AT')`
- Item appeared → `gameKG.trackEntity('item', thing)` + `trackEdge(item, location, 'LOCATED_AT')`

**On chatHistory poll (new turn detected):**
- New location in history → `gameKG.trackEntity('location', loc)` + `trackEdge(loc, region, 'PART_OF')`
- Player location changed → `gameKG.updateEntity(playerId, { locationId })`

**On world generation (via scope callbacks):**
- Region created → `gameKG.trackEntity('region', region)`
- Location generated → `gameKG.trackEntity('location', loc)`
- NPC generated → `gameKG.trackEntity('npc', npc)` + edges

**On combat/death:**
- NPC dies → `gameKG.removeEntity(npcId, { cause, killedBy })`
- Player dies → handled by PermadeathManager (already creates KG entity)

**On inventory change:**
- Item picked up → `gameKG.updateEntity(itemId, { ownerId })` + edge update
- Item dropped → `gameKG.updateEntity(itemId, { locationId })` + edge update

### Flush Timing

`gameKG.flush()` is called:
1. After each turn's chatHistory poll completes (alongside stack push)
2. Before autosave
3. On server shutdown (graceful)

Flush batches all pending operations into minimal API calls using the SDK.

## SDK Methods Used

Already available in `bonfires-sdk.js`:
- `kg.createEntity({ name, labels, summary, attributes })` → returns `{ uuid }`
- `kg.createEdge({ sourceUuid, targetUuid, edgeName, fact })`

Need to add:
- `kg.updateEntity(uuid, { name, labels, summary, attributes })` — call existing `POST /knowledge_graph/entity/{uuid}/update`

## Session kEngram

On server start:
1. Create session kEngram: `ke-{date}-{bonfire-id}`
2. As entities are flushed, pin them to the session kEngram
3. On server shutdown, the session kEngram has a complete record of what this session generated

Merge to topic kEngram (`ke-topic-{bonfire-id}`) can happen manually or on schedule.

## Verification

- Generate a location → check KG has entity with location name
- Generate NPCs → check KG has entities with LOCATED_AT edges
- Move player → check LOCATED_AT edge updated
- Kill NPC → check entity marked as removed/dead
- Restart server → manifest loads, known entities preserved
- `bonfire delve "Guard Barracks"` → returns location entity with connected NPCs
