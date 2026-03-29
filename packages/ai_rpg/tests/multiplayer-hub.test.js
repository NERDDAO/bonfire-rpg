'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MultiplayerHub } = require('../MultiplayerHub');

test('registers a player to a bonfire', () => {
  const hub = new MultiplayerHub();
  hub.addPlayer('b1', 'p1', { name: 'Alice' });
  const players = hub.getPlayers('b1');
  assert.equal(players.length, 1);
  assert.equal(players[0].id, 'p1');
  assert.equal(players[0].name, 'Alice');
});

test('registers multiple players to same bonfire', () => {
  const hub = new MultiplayerHub();
  hub.addPlayer('b1', 'p1', { name: 'Alice' });
  hub.addPlayer('b1', 'p2', { name: 'Bob' });
  assert.equal(hub.getPlayerCount('b1'), 2);
});

test('players in different bonfires are isolated', () => {
  const hub = new MultiplayerHub();
  hub.addPlayer('b1', 'p1', { name: 'Alice' });
  hub.addPlayer('b2', 'p2', { name: 'Bob' });
  const b1Players = hub.getPlayers('b1');
  const b2Players = hub.getPlayers('b2');
  assert.equal(b1Players.length, 1);
  assert.equal(b1Players[0].id, 'p1');
  assert.equal(b2Players.length, 1);
  assert.equal(b2Players[0].id, 'p2');
});

test('removes a player from a bonfire', () => {
  const hub = new MultiplayerHub();
  hub.addPlayer('b1', 'p1', { name: 'Alice' });
  hub.removePlayer('b1', 'p1');
  assert.equal(hub.getPlayers('b1').length, 0);
});

test('getPlayers returns empty array for unknown bonfire', () => {
  const hub = new MultiplayerHub();
  const players = hub.getPlayers('nonexistent');
  assert.deepEqual(players, []);
});

test('getPlayersInLocation filters by locationId', () => {
  const hub = new MultiplayerHub();
  hub.addPlayer('b1', 'p1', { name: 'Alice', locationId: 'loc1' });
  hub.addPlayer('b1', 'p2', { name: 'Bob', locationId: 'loc1' });
  hub.addPlayer('b1', 'p3', { name: 'Carol', locationId: 'loc2' });
  const loc1Players = hub.getPlayersInLocation('b1', 'loc1');
  const loc2Players = hub.getPlayersInLocation('b1', 'loc2');
  assert.equal(loc1Players.length, 2);
  assert.equal(loc2Players.length, 1);
  assert.equal(loc2Players[0].id, 'p3');
});

test('updatePlayerLocation changes location', () => {
  const hub = new MultiplayerHub();
  hub.addPlayer('b1', 'p1', { name: 'Alice', locationId: 'loc1' });
  assert.equal(hub.getPlayersInLocation('b1', 'loc1').length, 1);
  hub.updatePlayerLocation('b1', 'p1', 'loc2');
  assert.equal(hub.getPlayersInLocation('b1', 'loc1').length, 0);
  assert.equal(hub.getPlayersInLocation('b1', 'loc2').length, 1);
});

test('broadcastOOC sends to all players in bonfire', () => {
  const hub = new MultiplayerHub();
  const messages = [];
  hub.setSendFn((pid, msg) => messages.push({ pid, msg }));
  hub.addPlayer('b1', 'p1', { name: 'Alice' });
  hub.addPlayer('b1', 'p2', { name: 'Bob' });
  hub.broadcastOOC('b1', 'p1', 'Hello everyone!');
  assert.equal(messages.length, 2);
  const pids = messages.map(m => m.pid);
  assert.ok(pids.includes('p1'));
  assert.ok(pids.includes('p2'));
  for (const { msg } of messages) {
    assert.equal(msg.type, 'ooc_chat');
    assert.equal(msg.from, 'p1');
    assert.equal(msg.text, 'Hello everyone!');
  }
});

test('broadcastOOC does not leak to other bonfires', () => {
  const hub = new MultiplayerHub();
  const messages = [];
  hub.setSendFn((pid, msg) => messages.push({ pid, msg }));
  hub.addPlayer('b1', 'p1', { name: 'Alice' });
  hub.addPlayer('b2', 'p2', { name: 'Bob' });
  hub.broadcastOOC('b1', 'p1', 'Hello b1!');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].pid, 'p1');
});

test('broadcastToLocation sends only to players in that location', () => {
  const hub = new MultiplayerHub();
  const messages = [];
  hub.setSendFn((pid, msg) => messages.push({ pid, msg }));
  hub.addPlayer('b1', 'p1', { name: 'Alice', locationId: 'loc1' });
  hub.addPlayer('b1', 'p2', { name: 'Bob', locationId: 'loc1' });
  hub.addPlayer('b1', 'p3', { name: 'Carol', locationId: 'loc2' });
  hub.broadcastToLocation('b1', 'loc1', { type: 'room_event', data: 'something happened' });
  assert.equal(messages.length, 2);
  const pids = messages.map(m => m.pid);
  assert.ok(pids.includes('p1'));
  assert.ok(pids.includes('p2'));
  assert.ok(!pids.includes('p3'));
});

test('getPlayerCount returns count for bonfire', () => {
  const hub = new MultiplayerHub();
  hub.addPlayer('b1', 'p1', { name: 'Alice' });
  hub.addPlayer('b1', 'p2', { name: 'Bob' });
  assert.equal(hub.getPlayerCount('b1'), 2);
  assert.equal(hub.getPlayerCount('b2'), 0);
});
