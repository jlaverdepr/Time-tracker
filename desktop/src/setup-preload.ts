import { contextBridge, ipcRenderer } from "electron";

// Exposed to setup.html only — lets that page hand the entered URL/token to
// the main process (which validates reachability, persists it, and
// navigates this same window to the live server) without giving the page
// itself any broader Node/Electron access.
contextBridge.exposeInMainWorld("desktopSetup", {
  save: (url: string, token: string): Promise<boolean> =>
    ipcRenderer.invoke("save-remote-config", { url, token }),
});
