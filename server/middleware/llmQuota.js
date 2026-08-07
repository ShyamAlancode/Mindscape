/**
 * llmQuota.js — Per-user daily quota enforcement middleware for LLM endpoints.
 */

import { getUserSubscription, getUserDailyUsage, incrementUserDailyUsage } from "../db/database.js";

export function llmQuotaMiddleware(maxDailyFreeTier = 50) {
  return async (c, next) => {
    const user = c.get("user") || { id: "guest_user", tier: "free" };
    const sub = getUserSubscription(user.id);
    const limit = sub.tier === "pro" ? 1000 : maxDailyFreeTier;

    const currentUsage = getUserDailyUsage(user.id);

    if (currentUsage >= limit) {
      return c.json({
        error: "Quota Exceeded",
        message: `You have reached your daily LLM request cap (${limit} requests/day). Upgrade to Pro for higher limits.`,
        limit,
        usage: currentUsage,
      }, 429);
    }

    incrementUserDailyUsage(user.id);
    return next();
  };
}
