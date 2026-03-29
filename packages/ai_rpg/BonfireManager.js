'use strict';

const { GameInstance } = require('./GameInstance');

class BonfireManager {
  constructor() {
    this.instances = new Map();
  }

  get size() {
    return this.instances.size;
  }

  create(id, options = {}) {
    if (this.instances.has(id)) {
      throw new Error(`Bonfire instance "${id}" already exists`);
    }
    const instance = new GameInstance(id, options);
    this.instances.set(id, instance);
    return instance;
  }

  get(id) {
    return this.instances.get(id);
  }

  has(id) {
    return this.instances.has(id);
  }

  getOrCreate(id, options = {}) {
    if (this.instances.has(id)) {
      return this.instances.get(id);
    }
    return this.create(id, options);
  }

  unload(id) {
    if (!this.instances.has(id)) {
      return false;
    }
    const instance = this.instances.get(id);
    instance.clearWorldState();
    this.instances.delete(id);
    return true;
  }

  list() {
    return Array.from(this.instances.keys());
  }
}

module.exports = { BonfireManager };
