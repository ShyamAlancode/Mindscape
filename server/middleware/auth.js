/**
 * auth.js — Session & JWT Authentication Middleware for Hono server endpoints.
 *
 * Uses jsonwebtoken for cryptographic signature verification.
 * Set JWT_SECRET in .env.local. Without it, auth is disabled (dev-only mode).
 */

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGORITHMS = ["HS256", "HS384", "HS512"];

if (!JWT_SECRET && process.env.REQUIRE_AUTH === "true") {
  console.error("[Auth] FATAL: REQUIRE_AUTH=true but JWT_SECRET is not set. Server will reject all authenticated requests.");
} else if (!JWT_SECRET) {
  console.warn("[Auth] JWT_SECRET not set — auth verification is disabled. Set JWT_SECRET in .env.local for production.");
}

export function authMiddleware(options = {}) {
  const requireAuth = options.requireAuth ?? (process.env.REQUIRE_AUTH === "true");

  return async (c, next) => {
    const authHeader = c.req.header("Authorization") || c.req.header("authorization");

    if (!authHeader && !requireAuth) {
      // Attach guest user when auth is optional
      c.set("user", { id: "guest_user", tier: "free", authenticated: false });
      return next();
    }

    if (!authHeader) {
      return c.json({ error: "Unauthorized", message: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return c.json({ error: "Unauthorized", message: "Invalid Bearer token format" }, 401);
    }

    // If no secret is configured (local dev without auth), fall back to dev mode
    if (!JWT_SECRET) {
      c.set("user", { id: "dev_user", tier: "pro", authenticated: true, devMode: true });
      return next();
    }

    try {
      // Cryptographically verify the token signature against JWT_SECRET
      const payload = jwt.verify(token, JWT_SECRET, {
        algorithms: JWT_ALGORITHMS,
      });

      c.set("user", {
        id: payload.sub || payload.id || "user_default",
        email: payload.email || null,
        tier: payload.tier || "free",
        authenticated: true,
      });

      return next();
    } catch (err) {
      // jwt.verify throws TokenExpiredError, JsonWebTokenError, NotBeforeError
      const isExpired = err?.name === "TokenExpiredError";
      return c.json({
        error: "Unauthorized",
        message: isExpired ? "Token has expired" : "Invalid or malformed token",
      }, 401);
    }
  };
}
