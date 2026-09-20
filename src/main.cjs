const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  powerMonitor,
} = require("electron");
const path = require("node:path");
const { Tracker } = require("./tracker.cjs");
let tracker;
let window;
let interval;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      window.restore();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    try {
      tracker = new Tracker(
        path.join(app.getPath("userData"), "tracking.json"),
      );
    } catch (error) {
      dialog.showErrorBox("Could not open your history", error.message);
      app.quit();
      return;
    }
    window = new BrowserWindow({
      width: 1120,
      height: 820,
      minWidth: 760,
      minHeight: 620,
      backgroundColor: "#f8faf7",
      title: "Cookie Tracker",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    const safely = (fn) => {
      try {
        return fn();
      } catch (error) {
        tracker.active = null;
        dialog.showErrorBox("Tracking stopped: could not save", error.message);
        return tracker.snapshot();
      }
    };
    ipcMain.handle("tracker:read", () => tracker.snapshot());
    ipcMain.handle("tracker:start", () => safely(() => tracker.start()));
    ipcMain.handle("tracker:stop", () => safely(() => tracker.stop()));
    interval = setInterval(() => {
      safely(() => tracker.checkpoint());
      if (!window.isDestroyed())
        window.webContents.send("tracker:changed", tracker.snapshot());
    }, 1000);
    powerMonitor.on("suspend", () => safely(() => tracker.stop()));
    window.on("close", () => safely(() => tracker.stop()));
    app.on("before-quit", () => {
      clearInterval(interval);
      safely(() => tracker.stop());
    });
    window.loadFile(path.join(__dirname, "index.html"));
  });
  app.on("window-all-closed", () => app.quit());
}
