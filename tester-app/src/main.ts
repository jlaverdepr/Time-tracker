import { app, shell, Tray, Menu, nativeImage } from "electron";
import { createServer } from "node:net";
import path from "node:path";

// The bundled api-server logger uses pino's "pino-pretty" transport in
// non-production mode, which requires resolving a real file from a worker
// thread — that file doesn't exist once everything is bundled into one file.
process.env.NODE_ENV = "production";

const APP_NAME = "FocusTime Tester";
app.setName(APP_NAME);

let tray: Tray | null = null;
let currentUrl: string | null = null;

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
  const express = (await import("express")).default;

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

function openInBrowser() {
  if (currentUrl) shell.openExternal(currentUrl);
}

function iconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "tray-icon.png")
    : path.join(repoRoot, "tester-app/build/tray-icon.png");
}

function createTray() {
  const image = nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open in Browser", click: openInBrowser },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
  // No window ever opens, so the tray icon is the only click surface — treat
  // a left-click the same as picking "Open in Browser" from the menu.
  tray.on("click", openInBrowser);
}

app.whenReady().then(async () => {
  try {
    const port = await startServer();
    currentUrl = `http://127.0.0.1:${port}/`;
    createTray();
    openInBrowser();
  } catch (err) {
    console.error(`${APP_NAME} failed to start:`, err);
    app.quit();
  }
});

// This app never opens a BrowserWindow, so there's nothing for
// "window-all-closed" to react to — it stays running (reachable via the
// tray) until the user picks "Quit", on both macOS and Windows.
app.on("activate", () => {
  openInBrowser();
});
