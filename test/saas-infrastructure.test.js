import { test } from "node:test";
import assert from "node:assert";
import { llmCache } from "../server/services/llmCache.js";
import { getUserSubscription, updateUserSubscription, getUserDailyUsage, incrementUserDailyUsage } from "../server/db/database.js";

test("llmCache normalizes prompt keys and caches responses correctly", () => {
  llmCache.clear();
  const prompt = "  Calculate the   volume of a RADIUS 5 sphere!! ";
  const val = { planId: "sphere-5" };

  llmCache.set(prompt, val);
  const hit = llmCache.get("calculate the volume of a radius 5 sphere");

  assert.deepStrictEqual(hit, val);
});

test("database manages user subscriptions and daily usage counts", () => {
  const userId = `test_user_saas_${Date.now()}`;
  const initial = getUserSubscription(userId);
  assert.strictEqual(initial.tier, "free");

  updateUserSubscription(userId, { tier: "pro", status: "active" });
  const updated = getUserSubscription(userId);
  assert.strictEqual(updated.tier, "pro");

  const usageBefore = getUserDailyUsage(userId);
  incrementUserDailyUsage(userId);
  const usageAfter = getUserDailyUsage(userId);
  assert.strictEqual(usageAfter, usageBefore + 1);
});
