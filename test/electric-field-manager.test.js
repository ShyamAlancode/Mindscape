import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ElectricFieldManager } from "../src/render/electricFieldManager.js";

test("simulateCoulombMotion does not throw once simulation is running", () => {
  const fakeSceneApi = {
    snapshot: () => ({ objects: [] }),
    updateObjectPosition: () => {},
  };
  const fakeWorld = { scene: { add: () => {} } };
  const manager = new ElectricFieldManager(fakeWorld, fakeSceneApi);

  manager.setSimulationPlay(true);

  const charges = [
    {
      id: "charge_a",
      position: new THREE.Vector3(-1, 1, 0),
      charge: 1,
      strength: 1,
      radius: 0.35,
    },
    {
      id: "charge_b",
      position: new THREE.Vector3(1, 1, 0),
      charge: -1,
      strength: 1,
      radius: 0.35,
    },
  ];

  assert.doesNotThrow(() => manager.simulateCoulombMotion(0.016, charges));
});
