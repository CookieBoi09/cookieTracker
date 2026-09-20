const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("tracker", {
  read: () => ipcRenderer.invoke("tracker:read"),
  start: () => ipcRenderer.invoke("tracker:start"),
  stop: () => ipcRenderer.invoke("tracker:stop"),
  onChange: (callback) =>
    ipcRenderer.on("tracker:changed", (_, state) => callback(state)),
});
