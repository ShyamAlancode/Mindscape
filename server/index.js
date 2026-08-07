import "./env.js"; // MUST be first: loads .env.local before any other module reads process.env
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import net from "node:net";

// Import routes
import planRoute from "./routes/plan.js";
import tutorRoute from "./routes/tutor.js";
import voiceRoute from "./routes/voice.js";
import challengesRoute from "./routes/challenges.js";
import buildRoute from "./routes/build.js";
import capabilitiesRoute from "./routes/capabilities.js";
import chatRoute from "./routes/chat.js";
import { billingRouter } from "./routes/billing.js";
import { warmLessonExemplars } from "./services/plan/retrieval.js";
import { initClassroomWebSocketServer } from "./services/classroomServer.js";
import { createRateLimit } from "./middleware/rateLimit.js";
import { authMiddleware } from "./middleware/auth.js";
import { llmQuotaMiddleware } from "./middleware/llmQuota.js";

const app = new Hono();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : "*";

// Middleware
app.use("*", logger());
app.use("*", cors({ origin: allowedOrigins }));
app.use("/api/*", createRateLimit({
  maxRequests: Number(process.env.API_RATE_LIMIT || 60),
  windowMs: Number(process.env.API_RATE_WINDOW_MS || 60_000),
}));
app.use("/api/*", authMiddleware());
app.use("/api/plan", llmQuotaMiddleware());

// API routes
app.route("/api/plan", planRoute);
app.route("/api/tutor", tutorRoute);
app.route("/api/voice", voiceRoute);
app.route("/api/challenges", challengesRoute);
app.route("/api/build", buildRoute);
app.route("/api/capabilities", capabilitiesRoute);
app.route("/api/chat", chatRoute);
app.route("/api/billing", billingRouter);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

import fs from "node:fs";

// Serve static files ONLY from ./dist or ./public — never expose .env.local, server/, or .git/
const staticRoot = fs.existsSync("./dist") ? "./dist" : "./public";
app.use("/*", serveStatic({ root: staticRoot }));

const DEFAULT_PORT = parseInt(process.env.PORT || "3000", 10);

function probePort(port) {
  return new Promise((resolveProbe) => {
    const tester = net.createServer();
    tester.unref();
    tester.once("error", () => resolveProbe(false));
    tester.once("listening", () => {
      tester.close(() => resolveProbe(true));
    });
    tester.listen(port);
  });
}

async function findAvailablePort(startPort, attempts = 10) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = startPort + offset;
    if (await probePort(candidate)) {
      return candidate;
    }
  }
  throw new Error(`No open port found between ${startPort} and ${startPort + attempts - 1}`);
}

const PORT = await findAvailablePort(DEFAULT_PORT);
void warmLessonExemplars();

if (PORT !== DEFAULT_PORT) {
  console.warn(`Port ${DEFAULT_PORT} is busy, starting Mindscape on ${PORT} instead.`);
}

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Mindscape server running at http://localhost:${info.port}`);
  console.log(`  API: http://localhost:${info.port}/api/health`);
  console.log(`  App: http://localhost:${info.port}/index.html`);
  console.log(`  WebSocket Classroom: ws://localhost:${info.port}/ws/classroom`);
});

initClassroomWebSocketServer(server);

