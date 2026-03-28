'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('Globals.activeInstance', () => {
  beforeEach(() => {
    const Globals = require('../Globals');
    Globals.activeInstance = null;
  });

  it('defaults to null', () => {
    const Globals = require('../Globals');
    assert.equal(Globals.activeInstance, null);
  });

  it('can be set to a GameInstance', () => {
    const Globals = require('../Globals');
    const { GameInstance } = require('../GameInstance');
    const inst = new GameInstance('test');

    Globals.activeInstance = inst;

    assert.equal(Globals.activeInstance, inst);
    assert.equal(Globals.activeInstance.id, 'test');
  });
});
