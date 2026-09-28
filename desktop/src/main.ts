import { app, BrowserWindow, Menu, ipcMain } from "electron";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const APP_NAME =
  process.env.APP_CHANNEL === "beta" ? "FocusTime Beta" : "FocusTime";

app.setName(APP_NAME);

// The app no longer hosts its own server/database — it's a thin client of
// the same always-on cloud server the phone app talks to, so a workout
// logged on either device shows up on both. See DEPLOY.md for the server
// side of this.
type RemoteConfig = { url: string; token: string };

function configPath(): string {
  return path.join(app.getPath("userData"), "remote-config.json");
}

function loadConfig(): RemoteConfig | null {
  const p = configPath();
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    if (
      typeof parsed?.url === "string" && parsed.url &&
      typeof parsed?.token === "string" && parsed.token
    ) {
      return { url: parsed.url, token: parsed.token };
    }
  } catch {
    // Malformed config file — treat as unconfigured.
  }
  return null;
}

function saveConfig(config: RemoteConfig): void {
  writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf-8");
}

function clearConfig(): void {
  const p = configPath();
  if (existsSync(p)) unlinkSync(p);
}

// `dist-main/**/*` (this file's own build output, including setup.html and
// setup-preload.js — see build/build-main.mjs) is packed into app.asar the
// same way whether or not the app is packaged, and Node/Electron resolve
// paths inside an asar transparently, so a plain __dirname-relative path
// works in both dev and packaged builds.
function resourcePath(...segments: string[]): string {
  return path.join(__dirname, ...segments);
}

async function checkServerReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let mainWindow: BrowserWindow | null = null;

function loadRemote(win: BrowserWindow, config: RemoteConfig): void {
  const target = new URL(config.url);
  target.searchParams.set("token", config.token);
  win.loadURL(target.toString());
}

function showSetup(win: BrowserWindow): void {
  win.loadFile(resourcePath("setup.html"));
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        {
          label: "Server Settings…",
          click: () => {
            clearConfig();
            if (mainWindow) showSetup(mainWindow);
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: APP_NAME,
    webPreferences: {
      preload: resourcePath("setup-preload.js"),
    },
  });
  mainWindow = win;

  const config = loadConfig();
  if (config) {
    loadRemote(win, config);
  } else {
    showSetup(win);
  }
}

ipcMain.handle(
  "save-remote-config",
  async (_event, { url, token }: RemoteConfig) => {
    const trimmedUrl = url.trim().replace(/\/+$/, "");
    const trimmedToken = token.trim();
    if (!trimmedUrl || !trimmedToken) return false;

    const reachable = await checkServerReachable(trimmedUrl);
    if (!reachable) return false;

    const config = { url: trimmedUrl, token: trimmedToken };
    saveConfig(config);
    if (mainWindow) loadRemote(mainWindow, config);
    return true;
  },
);

buildMenu();

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
