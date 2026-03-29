'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { BonfireManager } = require('../BonfireManager.js');
const { GameInstance } = require('../GameInstance.js');

test('creates a new instance', () => {
    const manager = new BonfireManager();
    const instance = manager.create('bonfire-1');
    assert.ok(instance instanceof GameInstance);
    assert.equal(instance.id, 'bonfire-1');
    assert.equal(manager.size, 1);
});

test('gets an existing instance', () => {
    const manager = new BonfireManager();
    manager.create('bonfire-1');
    const instance = manager.get('bonfire-1');
    assert.ok(instance instanceof GameInstance);
    assert.equal(instance.id, 'bonfire-1');
});

test('returns undefined for unknown instance', () => {
    const manager = new BonfireManager();
    const instance = manager.get('nonexistent');
    assert.equal(instance, undefined);
});

test('creates with options forwarded to GameInstance', () => {
    const manager = new BonfireManager();
    const options = { maxPlayers: 4, setting: 'fantasy' };
    const instance = manager.create('bonfire-1', options);
    assert.deepEqual(instance.config, options);
});

test('throws if creating duplicate id', () => {
    const manager = new BonfireManager();
    manager.create('bonfire-1');
    assert.throws(
        () => manager.create('bonfire-1'),
        /already exists/
    );
});

test('unloads an instance', () => {
    const manager = new BonfireManager();
    manager.create('bonfire-1');
    assert.equal(manager.size, 1);
    const result = manager.unload('bonfire-1');
    assert.equal(result, true);
    assert.equal(manager.size, 0);
    assert.equal(manager.get('bonfire-1'), undefined);
});

test('unload returns false for unknown id', () => {
    const manager = new BonfireManager();
    const result = manager.unload('nonexistent');
    assert.equal(result, false);
});

test('lists all instance ids', () => {
    const manager = new BonfireManager();
    manager.create('bonfire-a');
    manager.create('bonfire-b');
    manager.create('bonfire-c');
    const ids = manager.list();
    assert.deepEqual(ids.sort(), ['bonfire-a', 'bonfire-b', 'bonfire-c']);
});

test('has returns true for existing, false for missing', () => {
    const manager = new BonfireManager();
    manager.create('bonfire-1');
    assert.equal(manager.has('bonfire-1'), true);
    assert.equal(manager.has('nonexistent'), false);
});

test('getOrCreate returns existing instance without recreating', () => {
    const manager = new BonfireManager();
    const original = manager.create('bonfire-1');
    original.chatHistory.push({ role: 'user', content: 'hello' });
    const fetched = manager.getOrCreate('bonfire-1');
    assert.equal(fetched, original);
    assert.equal(fetched.chatHistory.length, 1);
    assert.equal(manager.size, 1);
});

test('getOrCreate creates new instance if missing', () => {
    const manager = new BonfireManager();
    const instance = manager.getOrCreate('bonfire-new');
    assert.ok(instance instanceof GameInstance);
    assert.equal(instance.id, 'bonfire-new');
    assert.equal(manager.size, 1);
});
