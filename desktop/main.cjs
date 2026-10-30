const { app, BrowserWindow, Menu, dialog } = require("electron");
const path = require("node:path");

const MERCHANT_URL = "https://www.burgerbudds.in/merchant";
const TRUSTED_ORIGIN = new URL(MERCHANT_URL).origin;
let mainWindow;

function isTrusted(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === TRUSTED_ORIGIN && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function openMerchant() {
  return mainWindow.loadURL(MERCHANT_URL).catch(() => {});
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Burger Budds Merchant",
    width: 1366,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#ffffff",
    webPreferences: {
      partition: "persist:burger-budds-merchant",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });
  const contents = mainWindow.webContents;
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  contents.session.setPermissionCheckHandler(() => false);
  contents.session.on("will-download", (event) => event.preventDefault());
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    if (isTrusted(url)) contents.loadURL(url).catch(() => {});
    return { action: "deny" };
  });
  for (const eventName of ["will-navigate", "will-redirect", "will-frame-navigate"]) {
    contents.on(eventName, (event, url) => {
      if (!isTrusted(url)) event.preventDefault();
    });
  }
  contents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isTrusted(_url)) {
      mainWindow.loadFile(path.join(__dirname, "offline.html")).catch(() => {});
    }
  });
  contents.on("render-process-gone", () => {
    dialog.showMessageBox(mainWindow, {
      type: "error",
      message: "The merchant page stopped responding.",
      detail: "Use App > Open Merchant to reconnect."
    });
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "App", submenu: [
      { label: "Open Merchant / Retry Connection", accelerator: "CmdOrCtrl+Home", click: openMerchant },
      { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => { if (isTrusted(contents.getURL())) contents.reload(); else openMerchant(); } },
      { type: "separator" },
      { role: "quit" }
    ] },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "togglefullscreen" }] }
  ]));
  openMerchant();
}

app.enableSandbox();
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => app.quit());
}
