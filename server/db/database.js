/**
 * database.js — SQLite-backed persistence layer for User Subscriptions & Usage Data.
 *
 * Replaces the in-memory Map() storage with better-sqlite3, providing:
 * - Data persistence across server restarts and crashes
 * - Atomic transactions for usage counting
 * - Zero-config: DB file is created automatically at startup
 */

import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, "../../data");
const DB_PATH = process.env.DATABASE_PATH || join(DB_DIR, "mindscape.db");

// Ensure the data directory exists
mkdirSync(DB_DIR, { recursive: true });

let db;
try {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL"); // Better concurrent read performance
  db.pragma("foreign_keys = ON");
  console.log(`[DB] SQLite database opened at: ${DB_PATH}`);
} catch (err) {
  console.error("[DB] Failed to open SQLite database:", err.message);
  // Fallback to in-memory database if file system is unavailable
  db = new Database(":memory:");
  console.warn("[DB] Falling back to in-memory database — data will not persist across restarts.");
}

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id      TEXT PRIMARY KEY,
    status       TEXT    NOT NULL DEFAULT 'inactive',
    tier         TEXT    NOT NULL DEFAULT 'free',
    daily_quota  INTEGER NOT NULL DEFAULT 50,
    customer_id  TEXT,
    subscription_id TEXT,
    updated_at   INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_daily_usage (
    user_id TEXT NOT NULL,
    date    TEXT NOT NULL,
    count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  );
`);

// ─── Prepared Statements ──────────────────────────────────────────────────────

const stmtGetSubscription = db.prepare(
  "SELECT * FROM user_subscriptions WHERE user_id = ?",
);

const stmtUpsertSubscription = db.prepare(`
  INSERT INTO user_subscriptions (user_id, status, tier, daily_quota, customer_id, subscription_id, updated_at)
  VALUES (@userId, @status, @tier, @dailyQuota, @customerId, @subscriptionId, @updatedAt)
  ON CONFLICT(user_id) DO UPDATE SET
    status          = excluded.status,
    tier            = excluded.tier,
    daily_quota     = COALESCE(excluded.daily_quota, user_subscriptions.daily_quota),
    customer_id     = COALESCE(excluded.customer_id, user_subscriptions.customer_id),
    subscription_id = COALESCE(excluded.subscription_id, user_subscriptions.subscription_id),
    updated_at      = excluded.updated_at
`);

const stmtGetUsage = db.prepare(
  "SELECT count FROM user_daily_usage WHERE user_id = ? AND date = ?",
);

const stmtIncrementUsage = db.prepare(`
  INSERT INTO user_daily_usage (user_id, date, count)
  VALUES (?, ?, 1)
  ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
  RETURNING count
`);

// ─── Public API ───────────────────────────────────────────────────────────────

export function getUserSubscription(userId) {
  const row = stmtGetSubscription.get(userId);
  if (row) {
    return {
      userId: row.user_id,
      status: row.status,
      tier: row.tier,
      dailyQuota: row.daily_quota,
      customerId: row.customer_id,
      subscriptionId: row.subscription_id,
      updatedAt: row.updated_at,
    };
  }
  // Default free-tier subscription for unknown users
  return {
    userId,
    status: "inactive",
    tier: "free",
    dailyQuota: 50,
  };
}

export function updateUserSubscription(userId, data) {
  const current = getUserSubscription(userId);
  stmtUpsertSubscription.run({
    userId,
    status: data.status ?? current.status,
    tier: data.tier ?? current.tier,
    dailyQuota: data.dailyQuota ?? current.dailyQuota ?? 50,
    customerId: data.customerId ?? current.customerId ?? null,
    subscriptionId: data.subscriptionId ?? current.subscriptionId ?? null,
    updatedAt: data.updatedAt ?? Date.now(),
  });
  return getUserSubscription(userId);
}

export function getUserDailyUsage(userId) {
  const today = new Date().toISOString().split("T")[0];
  const row = stmtGetUsage.get(userId, today);
  return row ? row.count : 0;
}

export function incrementUserDailyUsage(userId) {
  const today = new Date().toISOString().split("T")[0];
  const row = stmtIncrementUsage.get(userId, today);
  return row ? row.count : 1;
}

export { db };
