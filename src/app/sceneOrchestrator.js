/**
 * sceneOrchestrator.js — Orchestrates Three.js scene creation, mesh loading, and rendering state.
 */

import { createWorld } from "../render/world.js";
import { createSceneRuntime } from "../scene/sceneRuntime.js";

export class SceneOrchestrator {
  constructor(canvasContainerEl) {
    this.container = canvasContainerEl;
    this.world = null;
    this.runtime = null;
    this.placedMeshes = new Map();
  }

  init() {
    if (this.world) return this.world;

    this.world = createWorld(this.container);
    this.runtime = createSceneRuntime(this.world);
    return this.world;
  }

  clearScene() {
    if (!this.runtime) return;
    this.runtime.clearScene();
    this.placedMeshes.clear();
  }

  loadPlan(scenePlan) {
    if (!this.runtime || !scenePlan) return;
    this.clearScene();
    this.runtime.loadLegacyScene(scenePlan);
  }

  render() {
    if (this.world) {
      this.world.render();
    }
  }

  destroy() {
    this.clearScene();
    if (this.world?.dispose) {
      this.world.dispose();
    }
    this.world = null;
    this.runtime = null;
  }
}
