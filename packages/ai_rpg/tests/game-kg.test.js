const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { GameKG } = require('../mods/bonfires-gm/game-kg');

// Temp manifest path for tests
const TEST_MANIFEST = path.join(__dirname, '.test-game-kg-manifest.json');

function cleanup() {
  try { fs.unlinkSync(TEST_MANIFEST); } catch {}
}

function makeMockSdk() {
  const calls = [];
  return {
    calls,
    kg: {
      createEntity: async (params) => {
        calls.push({ method: 'createEntity', params });
        return { uuid: `uuid-${params.name.replace(/\s/g, '-').toLowerCase()}` };
      },
      updateEntity: async (uuid, params) => {
        calls.push({ method: 'updateEntity', uuid, params });
        return {};
      },
      createEdge: async (params) => {
        calls.push({ method: 'createEdge', params });
        return {};
      },
    },
  };
}

describe('GameKG', () => {
  let kg;
  let sdk;

  beforeEach(() => {
    cleanup();
    sdk = makeMockSdk();
    kg = new GameKG({ sdk, manifestPath: TEST_MANIFEST, bonfireId: 'test' });
  });

  // --- trackEntity ---

  it('tracks a new entity', () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'A ranger' });
    assert.equal(kg.pendingCount, 1);
  });

  it('deduplicates tracked entities', () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'A ranger' });
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'A ranger' });
    assert.equal(kg.pendingCount, 1);
  });

  it('skips entity without gameId or name', () => {
    kg.trackEntity('npc', { gameId: '', name: 'Corvus' });
    kg.trackEntity('npc', { gameId: 'p1', name: '' });
    assert.equal(kg.pendingCount, 0);
  });

  // --- trackEdge ---

  it('tracks a structural edge', () => {
    kg.trackEdge('Corvus', 'Guard Barracks', 'LOCATED_AT', 'Corvus is at the barracks');
    assert.equal(kg.pendingCount, 1);
  });

  // --- flush ---

  it('flushes creates to KG and stores UUIDs', async () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'A ranger', labels: ['human'] });
    const result = await kg.flush();
    assert.equal(result.created, 1);
    assert.equal(sdk.calls.length, 1);
    assert.equal(sdk.calls[0].method, 'createEntity');
    assert.equal(sdk.calls[0].params.name, 'Corvus');
    assert.ok(sdk.calls[0].params.labels.includes('npc'));
    assert.ok(sdk.calls[0].params.labels.includes('human'));

    // UUID stored
    assert.equal(kg.getUuid('p1'), 'uuid-corvus');
    assert.equal(kg.isTracked('p1'), true);
    assert.equal(kg.trackedCount, 1);
  });

  it('flushes edges with resolved UUIDs', async () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    kg.trackEntity('location', { gameId: 'loc1', name: 'Guard Barracks', description: 'A barracks' });
    kg.trackEdge('Corvus', 'Guard Barracks', 'LOCATED_AT', 'Corvus is here');
    const result = await kg.flush();
    assert.equal(result.created, 2);
    assert.equal(result.edges, 1);

    const edgeCall = sdk.calls.find(c => c.method === 'createEdge');
    assert.equal(edgeCall.params.sourceUuid, 'uuid-corvus');
    assert.equal(edgeCall.params.targetUuid, 'uuid-guard-barracks');
    assert.equal(edgeCall.params.edgeName, 'LOCATED_AT');
  });

  it('clears pending after flush', async () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    await kg.flush();
    assert.equal(kg.pendingCount, 0);
  });

  it('skips duplicate on second flush', async () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    await kg.flush();
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    assert.equal(kg.pendingCount, 0); // deduped because already known
  });

  // --- updateEntity ---

  it('flushes updates to KG', async () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    await kg.flush();
    sdk.calls.length = 0;

    kg.updateEntity('p1', { attributes: { health: 10 } });
    const result = await kg.flush();
    assert.equal(result.updated, 1);
    assert.equal(sdk.calls[0].method, 'updateEntity');
    assert.equal(sdk.calls[0].uuid, 'uuid-corvus');
  });

  it('ignores updates to unknown entities', () => {
    kg.updateEntity('unknown', { attributes: { health: 10 } });
    assert.equal(kg.pendingCount, 0);
  });

  // --- markEntity ---

  it('creates status edge for death (append-only)', async () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    await kg.flush();
    sdk.calls.length = 0;

    kg.markEntity('p1', 'died', { cause: 'Slain by Seeker' });
    const result = await kg.flush();
    assert.equal(result.edges, 1);
    assert.equal(result.updated, 1); // attributes update

    const edgeCall = sdk.calls.find(c => c.method === 'createEdge');
    assert.equal(edgeCall.params.edgeName, 'HAS_STATUS');
    assert.ok(edgeCall.params.fact.includes('died'));
    assert.ok(edgeCall.params.fact.includes('Slain by Seeker'));
  });

  // --- manifest persistence ---

  it('saves and loads manifest', async () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    kg.trackEntity('location', { gameId: 'loc1', name: 'Barracks', description: 'A room' });
    await kg.flush();

    // Create new instance from same manifest
    const kg2 = new GameKG({ sdk, manifestPath: TEST_MANIFEST, bonfireId: 'test' });
    assert.equal(kg2.trackedCount, 2);
    assert.equal(kg2.getUuid('p1'), 'uuid-corvus');
    assert.equal(kg2.getUuid('loc1'), 'uuid-barracks');
    assert.equal(kg2.getByName('Corvus')?.uuid, 'uuid-corvus');
  });

  // --- getByName ---

  it('looks up entity by name', async () => {
    kg.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    await kg.flush();
    const entity = kg.getByName('Corvus');
    assert.equal(entity.uuid, 'uuid-corvus');
    assert.equal(entity.name, 'Corvus');
  });

  // --- no SDK ---

  it('handles missing SDK gracefully', async () => {
    const kgNoSdk = new GameKG({ sdk: null, manifestPath: TEST_MANIFEST, bonfireId: 'test' });
    kgNoSdk.trackEntity('npc', { gameId: 'p1', name: 'Corvus', description: 'Ranger' });
    const result = await kgNoSdk.flush();
    assert.equal(result.created, 0);
  });
});

// Cleanup after all tests
process.on('exit', cleanup);
