import { app, BrowserWindow, dialog } from "electron";
import { createServer } from "node:net";
import path from "node:path";
import express from "express";

// The bundled api-server logger uses pino's "pino-pretty" transport in
// non-production mode, which requires resolving a real file from a worker
// thread — that file doesn't exist once everything is bundled into one file.
process.env.NODE_ENV = "production";

const APP_NAME =
  process.env.APP_CHANNEL === "beta" ? "FocusTime Beta" : "FocusTime";

app.setName(APP_NAME);

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not determine a free port"));
      }
    });
  });
}

const repoRoot = path.join(__dirname, "..", "..");

function migrationsFolderPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "drizzle")
    : path.join(repoRoot, "lib/db/drizzle");
}

function staticDirPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "public")
    : path.join(repoRoot, "artifacts/time-tracker/dist/public");
}

async function startServer(): Promise<number> {
  process.env.DB_PATH = path.join(
    app.getPath("userData"),
    "time-tracker.sqlite",
  );

  const migrationsFolder = migrationsFolderPath();
  const staticDir = staticDirPath();

  const { db } = await import("@workspace/db");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  migrate(db, { migrationsFolder });

  const apiApp = (await import("@workspace/api-server")).default;

  const server = express();
  // apiApp (@workspace/api-server's app.ts) already mounts its router at
  // "/api" internally, so it's mounted at "/" here, not "/api".
  server.use(apiApp);
  server.use(express.static(staticDir));
  server.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });

  const port = await getFreePort();
  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return port;
}

async function createWindow(): Promise<void> {
  let port: number;
  try {
    port = await startServer();
  } catch (err) {
    dialog.showErrorBox(
      `${APP_NAME} failed to start`,
      `Could not set up the local database:\n\n${(err as Error).message}`,
    );
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: APP_NAME,
  });
  win.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
