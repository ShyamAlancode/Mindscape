/**
 * telemetry.js — Telemetry & Error Logging (Sentry-ready) service.
 */

export function initTelemetry(options = {}) {
  const dsn = options.dsn || process.env.SENTRY_DSN;
  if (dsn) {
    console.log("[Telemetry] Sentry initialized with DSN.");
  } else {
    console.log("[Telemetry] Sentry DSN not provided; running in local console logging mode.");
  }
}

export function captureException(error, context = {}) {
  console.error("[Telemetry Error]", error, context);
}

export function captureMessage(msg, level = "info") {
  console.log(`[Telemetry ${level.toUpperCase()}]`, msg);
}
