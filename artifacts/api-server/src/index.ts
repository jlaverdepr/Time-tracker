import path from "node:path";
import { existsSync } from "node:fs";
import express from "express";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Applies any pending schema migrations on boot. Drizzle tracks which ones
// have already run, so this is safe on every start — a fresh volume or a
// deploy with new migrations both just work with no manual step.
const migrationsDir = process.env["MIGRATIONS_DIR"];
if (migrationsDir) {
  migrate(db, { migrationsFolder: migrationsDir });
  logger.info({ migrationsDir }, "Database migrations applied");
} else {
  logger.warn("MIGRATIONS_DIR not set — skipping migrations");
}

const server = express();
server.use(app);

// Optional: serve a built web app (e.g. the desktop app's UI) from the same
// origin as the API. Mirrors what the desktop app's local server used to do
// for itself — one deployment can now serve both the API and that browser
// UI, so there's no separate origin/CORS story for the desktop client.
const staticDir = process.env["STATIC_DIR"];
if (staticDir && existsSync(staticDir)) {
  server.use(express.static(staticDir));
  server.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
  logger.info({ staticDir }, "Serving static UI");
}

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
