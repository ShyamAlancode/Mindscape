const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 60;

function clientKey(request) {
  const forwarded = request.header("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || request.header("x-real-ip") || "local";
}

export function createRateLimit({ windowMs = DEFAULT_WINDOW_MS, maxRequests = DEFAULT_MAX_REQUESTS, now = () => Date.now() } = {}) {
  const buckets = new Map();
  return async (c, next) => {
    const key = clientKey(c.req);
    const timestamp = now();
    const current = buckets.get(key);
    const bucket = !current || timestamp >= current.resetAt
      ? { count: 0, resetAt: timestamp + windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000));
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxRequests - bucket.count)));
    if (bucket.count > maxRequests) {
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests. Please wait a moment and try again.", code: "RATE_LIMITED", retryAfter }, 429);
    }
    return next();
  };
}
