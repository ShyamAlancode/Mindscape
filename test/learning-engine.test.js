import test from "node:test";
import assert from "node:assert/strict";
import { inferLessonMetadata } from "../src/core/lessonMetadata.js";
import { loadLearningProfile, profileSummary, recommendNextFocus, recordLearningSignal, recordLesson, saveLearningProfile } from "../src/core/learningProfile.js";
import { normalizeScenePlan } from "../src/ai/planSchema.js";

test("lesson metadata routes supported surface-area lessons to a verified curriculum tag", () => {
  const metadata = inferLessonMetadata({ question: "Find the surface area of a cuboid", questionType: "surface_area" });
  assert.equal(metadata.verification.status, "verified_local");
  assert.equal(metadata.curriculum.topic, "Mensuration");
});

test("normalized plans include learning metadata even when a planner omits it", () => {
  const plan = normalizeScenePlan({ problem: { question: "Find the volume of a cylinder", questionType: "volume" } });
  assert.equal(plan.lessonMetadata.verification.status, "verified_local");
  assert.equal(plan.lessonMetadata.curriculum.gradeBand, "Class 6-8");
});

test("local learning profile tracks started and completed lessons", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const plan = { problem: { question: "A cuboid" }, lessonMetadata: { curriculum: { topic: "Mensuration" } } };
  let profile = recordLesson(loadLearningProfile(storage), plan, "started");
  profile = recordLesson(profile, plan, "completed");
  profile = recordLearningSignal(profile, plan, "prediction_submitted");
  saveLearningProfile(profile, storage);
  assert.equal(loadLearningProfile(storage).topics.Mensuration.completed, 1);
  assert.match(profileSummary(profile), /1 lesson completed/i);
  assert.equal(profile.topics.Mensuration.signals.prediction_submitted, 1);
  assert.match(recommendNextFocus(profile), /Mensuration/i);
});
