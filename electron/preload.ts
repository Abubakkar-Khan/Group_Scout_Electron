import { contextBridge, ipcRenderer } from "electron";

// Expose safe APIs to the renderer process if needed in the future
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke("app:version"),
});
