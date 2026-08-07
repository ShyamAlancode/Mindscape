import test from "node:test";
import assert from "node:assert/strict";

import { generateScenePlan } from "../server/services/planService.js";

test("demo mode builds a local surface-area lesson without model calls", async () => {
  const events = [];
  const result = await generateScenePlan({
    questionText: "What is the surface area of a cuboid with length 6cm, width 4cm, and height 3cm?",
    mode: "demo",
  }, async (event, payload) => events.push({ event, payload }));

  assert.equal(result.scenePlan.problem.questionType, "surface_area");
  assert.ok(result.scenePlan.objectSuggestions.length > 0);
  assert.match(events[0].payload.systemWarning, /no API key is required/i);
  assert.equal(events.at(-1).event, "plan");
});
