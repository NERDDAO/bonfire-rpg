'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RoundManager } = require('../RoundManager');

test('queues an action for a location', () => {
  const rm = new RoundManager({ roundWindowMs: 100, onRoundClose: () => {} });
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  const round = rm.getRound('loc1');
  assert.equal(round.actions.length, 1);
  rm.destroy();
});

test('queues multiple actions in the same round', () => {
  const rm = new RoundManager({ roundWindowMs: 100, onRoundClose: () => {} });
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  rm.queueAction('loc1', { playerId: 'p2', text: 'defend' });
  const round = rm.getRound('loc1');
  assert.equal(round.actions.length, 2);
  rm.destroy();
});

test('separate locations have separate rounds', () => {
  const rm = new RoundManager({ roundWindowMs: 100, onRoundClose: () => {} });
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  rm.queueAction('loc2', { playerId: 'p2', text: 'flee' });
  assert.equal(rm.getRound('loc1').actions.length, 1);
  assert.equal(rm.getRound('loc2').actions.length, 1);
  assert.equal(rm.getRound('loc1').actions[0].playerId, 'p1');
  assert.equal(rm.getRound('loc2').actions[0].playerId, 'p2');
  rm.destroy();
});

test('returns null for location with no active round', () => {
  const rm = new RoundManager({ roundWindowMs: 100, onRoundClose: () => {} });
  assert.equal(rm.getRound('nonexistent'), null);
  rm.destroy();
});

test('fires onRoundClose after timer expires', async () => {
  let firedLocationId = null;
  let firedActions = null;
  const rm = new RoundManager({
    roundWindowMs: 100,
    onRoundClose: (locationId, actions) => {
      firedLocationId = locationId;
      firedActions = actions;
    },
  });
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  await new Promise(r => setTimeout(r, 150));
  assert.equal(firedLocationId, 'loc1');
  assert.equal(firedActions.length, 1);
  assert.equal(firedActions[0].playerId, 'p1');
});

test('round is cleared after close', async () => {
  const rm = new RoundManager({
    roundWindowMs: 100,
    onRoundClose: () => {},
  });
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  await new Promise(r => setTimeout(r, 150));
  assert.equal(rm.getRound('loc1'), null);
});

test('batches multiple actions before timer expires', async () => {
  let firedActions = null;
  const rm = new RoundManager({
    roundWindowMs: 100,
    onRoundClose: (_locationId, actions) => {
      firedActions = actions;
    },
  });
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  rm.queueAction('loc1', { playerId: 'p2', text: 'cast spell' });
  await new Promise(r => setTimeout(r, 150));
  assert.equal(firedActions.length, 2);
  assert.equal(firedActions[0].playerId, 'p1');
  assert.equal(firedActions[1].playerId, 'p2');
});

test('closeNow forces immediate round close', () => {
  let firedLocationId = null;
  let firedActions = null;
  const rm = new RoundManager({
    roundWindowMs: 100,
    onRoundClose: (locationId, actions) => {
      firedLocationId = locationId;
      firedActions = actions;
    },
  });
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  rm.closeNow('loc1');
  assert.equal(firedLocationId, 'loc1');
  assert.equal(firedActions.length, 1);
  assert.equal(rm.getRound('loc1'), null);
});

test('closeNow on empty location does nothing', () => {
  let callCount = 0;
  const rm = new RoundManager({
    roundWindowMs: 100,
    onRoundClose: () => { callCount++; },
  });
  rm.closeNow('nonexistent');
  assert.equal(callCount, 0);
  rm.destroy();
});

test('new actions after close start a new round', async () => {
  const calls = [];
  const rm = new RoundManager({
    roundWindowMs: 100,
    onRoundClose: (locationId, actions) => {
      calls.push({ locationId, actions });
    },
  });
  rm.queueAction('loc1', { playerId: 'p1', text: 'first action' });
  await new Promise(r => setTimeout(r, 150));
  rm.queueAction('loc1', { playerId: 'p1', text: 'second action' });
  await new Promise(r => setTimeout(r, 150));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].actions[0].text, 'first action');
  assert.equal(calls[1].actions[0].text, 'second action');
});

test('destroy clears all timers and rounds', () => {
  const rm = new RoundManager({
    roundWindowMs: 100,
    onRoundClose: () => {},
  });
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  rm.queueAction('loc2', { playerId: 'p2', text: 'flee' });
  assert.equal(rm.activeRoundCount, 2);
  rm.destroy();
  assert.equal(rm.activeRoundCount, 0);
  assert.equal(rm.getRound('loc1'), null);
  assert.equal(rm.getRound('loc2'), null);
});

test('activeRoundCount tracks open rounds', () => {
  const rm = new RoundManager({
    roundWindowMs: 100,
    onRoundClose: () => {},
  });
  assert.equal(rm.activeRoundCount, 0);
  rm.queueAction('loc1', { playerId: 'p1', text: 'attack' });
  assert.equal(rm.activeRoundCount, 1);
  rm.queueAction('loc2', { playerId: 'p2', text: 'flee' });
  assert.equal(rm.activeRoundCount, 2);
  rm.closeNow('loc1');
  assert.equal(rm.activeRoundCount, 1);
  rm.closeNow('loc2');
  assert.equal(rm.activeRoundCount, 0);
});
