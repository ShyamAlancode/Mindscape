/**
 * bootstrap.js — App-level bootstrap logic separating initialization from the main app controller.
 */

import { registry } from "./moduleRegistry.js";

export function bootstrapApp(config = {}) {
  console.log("Initializing Mindscape application...");
  
  registry.register("config", config);
  
  return {
    registry,
    startedAt: Date.now(),
  };
}
