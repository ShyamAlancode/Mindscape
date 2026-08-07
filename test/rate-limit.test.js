import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createRateLimit } from "../server/middleware/rateLimit.js";

test("rate limiter returns retry guidance after the configured request budget", async () => {
  const app = new Hono();
  app.use("*", createRateLimit({ maxRequests: 2, windowMs: 60_000 }));
  app.get("/", (c) => c.json({ ok: true }));
  assert.equal((await app.request("http://localhost/")).status, 200);
  assert.equal((await app.request("http://localhost/")).status, 200);
  const limited = await app.request("http://localhost/");
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "RATE_LIMITED");
  assert.equal(limited.headers.get("retry-after"), "60");
});
