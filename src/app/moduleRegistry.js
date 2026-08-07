/**
 * moduleRegistry.js — Module & dependency registry for the Mindscape application.
 */

class ModuleRegistry {
  constructor() {
    this.modules = new Map();
  }

  register(name, instance) {
    this.modules.set(name, instance);
    return instance;
  }

  get(name) {
    return this.modules.get(name);
  }

  has(name) {
    return this.modules.has(name);
  }

  clear() {
    this.modules.clear();
  }
}

export const registry = new ModuleRegistry();
