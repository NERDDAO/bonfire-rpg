'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { PermadeathManager } = require('../PermadeathManager.js');

function makeFixtures() {
  const sdkCalls = [];

  const mockSdk = {
    agents: {
      update: async (params) => { sdkCalls.push({ method: 'agents.update', params }); },
    },
    kg: {
      createEntity: async (params) => { sdkCalls.push({ method: 'kg.createEntity', params }); return { uuid: 'kg-uuid-1' }; },
      createEdge: async (params) => { sdkCalls.push({ method: 'kg.createEdge', params }); },
    },
  };

  const player = {
    id: 'p1',
    name: 'Seeker',
    agentId: 'agent-1',
    level: 5,
    class: 'Scavenger',
    race: 'Human',
    currentLocation: 'loc1',
    inventory: [
      { id: 't1', name: 'Rusty Sword' },
      { id: 't2', name: 'Health Potion' },
    ],
  };

  const gameState = {
    players: new Map(),
    things: new Map(),
    gameLocations: new Map([['loc1', { id: 'loc1', name: 'Ruined Guardhouse', thingIds: [] }]]),
  };

  return { sdkCalls, mockSdk, player, gameState };
}

test('marks player as dead', async () => {
  const { mockSdk, player, gameState } = makeFixtures();
  const mgr = new PermadeathManager({ sdk: mockSdk, gameState });
  const result = await mgr.processDeath(player, { cause: 'Slain by a troll' });
  assert.equal(result.isDead, true);
  assert.equal(result.playerId, 'p1');
  assert.equal(result.playerName, 'Seeker');
});

test('deactivates the agent via SDK', async () => {
  const { mockSdk, player, gameState, sdkCalls } = makeFixtures();
  const mgr = new PermadeathManager({ sdk: mockSdk, gameState });
  await mgr.processDeath(player, { cause: 'Fell into a pit' });
  const agentCall = sdkCalls.find(c => c.method === 'agents.update');
  assert.ok(agentCall, 'agents.update should have been called');
  assert.equal(agentCall.params.agentId, 'agent-1');
  assert.equal(agentCall.params.is_active, false);
});

test('creates KG entity for the corpse', async () => {
  const { mockSdk, player, gameState, sdkCalls } = makeFixtures();
  const mgr = new PermadeathManager({ sdk: mockSdk, gameState });
  await mgr.processDeath(player, { cause: 'Poisoned' });
  const kgCall = sdkCalls.find(c => c.method === 'kg.createEntity');
  assert.ok(kgCall, 'kg.createEntity should have been called');
  assert.ok(kgCall.params.name.includes('Seeker'), 'entity name should contain player name');
  assert.ok(kgCall.params.summary.includes('Poisoned'), 'summary should contain cause of death');
  assert.ok(kgCall.params.labels.includes('dead_player'), 'labels should include dead_player');
});

test('builds a legend summary with level and class', async () => {
  const { mockSdk, player, gameState, sdkCalls } = makeFixtures();
  const mgr = new PermadeathManager({ sdk: mockSdk, gameState });
  await mgr.processDeath(player, { cause: 'Crushed by a boulder' });
  const kgCall = sdkCalls.find(c => c.method === 'kg.createEntity');
  assert.ok(kgCall, 'kg.createEntity should have been called');
  assert.ok(kgCall.params.summary.includes('Level 5'), 'summary should include Level 5');
  assert.ok(kgCall.params.summary.includes('Scavenger'), 'summary should include class name');
});

test('drops inventory at death location', async () => {
  const { mockSdk, player, gameState } = makeFixtures();
  const mgr = new PermadeathManager({ sdk: mockSdk, gameState });
  await mgr.processDeath(player, { cause: 'Drowned' });
  const loc = gameState.gameLocations.get('loc1');
  assert.ok(loc.thingIds.includes('t1'), 'location should contain item t1');
  assert.ok(loc.thingIds.includes('t2'), 'location should contain item t2');
});

test('returns death result with location and cause', async () => {
  const { mockSdk, player, gameState } = makeFixtures();
  const mgr = new PermadeathManager({ sdk: mockSdk, gameState });
  const result = await mgr.processDeath(player, { cause: 'Stabbed by a bandit' });
  assert.equal(result.locationId, 'loc1');
  assert.equal(result.locationName, 'Ruined Guardhouse');
  assert.equal(result.cause, 'Stabbed by a bandit');
  assert.ok(result.legend.includes('Stabbed by a bandit'), 'legend should contain cause');
});

test('handles missing SDK gracefully', async () => {
  const { player, gameState } = makeFixtures();
  const mgr = new PermadeathManager({ sdk: null, gameState });
  let result;
  await assert.doesNotReject(async () => {
    result = await mgr.processDeath(player, { cause: 'Unknown' });
  });
  assert.equal(result.isDead, true);
});
