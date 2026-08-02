import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import http from "http";
import net from "net";
import { fork, ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;
let serverStartupError: Error | null = null;
let serverStderr = "";
let activeServerPort = 3000;
let isQuitting = false;

const isDev = !app.isPackaged;
const DEFAULT_PORT = 3000;

function getResourcePath(...segments: string[]) {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(base, ...segments);
}

function getStandaloneDir() {
  return app.isPackaged
    ? getResourcePath("next")
    : path.join(app.getAppPath(), ".next", "standalone");
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return false;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }

  return true;
}

// Load environment variables from the app bundle if available.
for (const envPath of [
  path.join(getStandaloneDir(), ".env"),
  getResourcePath(".env"),
  path.join(app.getAppPath(), ".env"),
]) {
  if (loadEnvFile(envPath)) break;
}

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * Find an available TCP port starting from startPort
 */
function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

/**
 * Wait for HTTP server to respond
 */
function waitForServer(port: number, timeoutMs = 60000): Promise<void> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (serverStartupError) {
        reject(serverStartupError);
        return;
      }

      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });

      req.on("error", () => retry());
      req.end();
    };

    const retry = () => {
      if (serverStartupError) {
        reject(serverStartupError);
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for Next.js server on port ${port}`));
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });
}

/**
 * Start the Next.js standalone production server
 */
async function startNextServer(port: number): Promise<void> {
  if (isDev) return;

  // --- Database setup: copy seed db to writable %APPDATA% ---
  const userDataPath = app.getPath("userData");
  if (!fs.existsSync(userDataPath)) {
    try { fs.mkdirSync(userDataPath, { recursive: true }); } catch {}
  }

  const dbPath = path.join(userDataPath, "database.db");
  if (!fs.existsSync(dbPath)) {
    // Try to copy the seed database shipped with the app
    for (const base of [getResourcePath(), app.getAppPath()]) {
      const src = path.join(base, "prisma", "dev.db");
      if (fs.existsSync(src)) {
        try { fs.copyFileSync(src, dbPath); } catch {}
        break;
      }
    }
  }
  const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

  // --- Find standalone server.js ---
  // The packaged app copies .next/standalone verbatim to resources/next.
  const standaloneDir = getStandaloneDir();
  const standaloneServerPaths = [
    path.join(standaloneDir, "server.js"),
    path.join(app.getAppPath().replace("app.asar", "app.asar.unpacked"), ".next", "standalone", "server.js"),
  ];

  let serverJs = "";
  for (const p of standaloneServerPaths) {
    if (fs.existsSync(p)) { serverJs = p; break; }
  }

  if (!serverJs) {
    const msg = `Could not find standalone server.js.\nSearched:\n${standaloneServerPaths.join("\n")}`;
    console.error(msg);
    dialog.showErrorBox("GroupScout Server Error", msg);
    return;
  }

  const serverEnv = {
    ...process.env,
    PORT: port.toString(),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production" as const,
    DATABASE_URL: dbUrl,
    ELECTRON_RUN_AS_NODE: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };

  console.log(`Starting standalone server: ${serverJs} on port ${port}`);
  serverStartupError = null;
  serverStderr = "";

  serverProcess = fork(serverJs, [], {
    cwd: path.dirname(serverJs),
    env: serverEnv,
    execPath: process.execPath,
    stdio: "pipe",
  });

  // Log stdout/stderr for debugging
  serverProcess.stdout?.on("data", (d: Buffer) => console.log("[next]", d.toString().trim()));
  serverProcess.stderr?.on("data", (d: Buffer) => {
    const text = d.toString();
    serverStderr = (serverStderr + text).slice(-6000);
    console.error("[next:err]", text.trim());
  });

  serverProcess.on("error", (err) => {
    serverStartupError = err;
    console.error("Server process error:", err);
    dialog.showErrorBox(
      "Next.js Server Error",
      `Failed to start server from ${serverJs}:\n\n${err.stack || err.message}`
    );
  });

  serverProcess.on("exit", (code, signal) => {
    console.log(`Server exited: code=${code} signal=${signal}`);
    if (code !== 0 && code !== null && !isQuitting) {
      serverStartupError = new Error(
        `The Next.js server exited unexpectedly with code ${code}.\n\n${serverStderr.trim()}`
      );
      dialog.showErrorBox(
        "Server Crashed",
        serverStartupError.message
      );
    }
  });
}

/**
 * Create or return application icon
 */
function getAppIcon(): Electron.NativeImage {
  const candidates = [
    getResourcePath("next", "public", "icon.png"),
    getResourcePath("public", "icon.png"),
    path.join(app.getAppPath(), "public", "icon.png"),
    path.join(__dirname, "..", "public", "icon.png"),
  ];

  for (const iconPath of candidates) {
    try {
      if (fs.existsSync(iconPath)) {
        const img = nativeImage.createFromPath(iconPath);
        if (!img.isEmpty()) return img;
      }
    } catch {}
  }

  return nativeImage.createEmpty();
}

/**
 * Create System Tray icon and menu
 */
function createTray() {
  const icon = getAppIcon();
  tray = new Tray(icon);
  tray.setToolTip("GroupScout Desktop");

  const updateMenu = () => {
    const loginItemSettings = app.getLoginItemSettings();
    const autoLaunchEnabled = loginItemSettings.openAtLogin;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open GroupScout",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: "Start on Windows Boot",
        type: "checkbox",
        checked: autoLaunchEnabled,
        click: (item) => {
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            path: process.execPath,
          });
          updateMenu();
        },
      },
      { type: "separator" },
      {
        label: "Quit GroupScout",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray?.setContextMenu(contextMenu);
  };

  updateMenu();

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * Create Main Electron Window
 */
async function createWindow(serverUrl: string) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "GroupScout",
    icon: getAppIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Intercept target="_blank" links and open in default external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.loadURL(serverUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Minimize to tray instead of quitting when close button is clicked
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Setup IPC handlers
ipcMain.handle("app:version", () => app.getVersion());

function formatError(error: unknown) {
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

app.whenReady().then(async () => {
  // Remove default top menu bar (File, Edit, View, Window) for clean UI
  Menu.setApplicationMenu(null);

  try {
    const port = isDev ? DEFAULT_PORT : await findAvailablePort(DEFAULT_PORT);
    activeServerPort = port;
    const serverUrl = `http://localhost:${port}`;

    if (!isDev) {
      await startNextServer(port);
    }

    await waitForServer(port);
    createTray();
    await createWindow(serverUrl);
  } catch (error: unknown) {
    console.error("Initialization error:", error);
    dialog.showErrorBox(
      "GroupScout Startup Error",
      `Failed to launch application:\n\n${formatError(error)}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  // Do not quit on window close to keep background automations running in tray
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow(`http://localhost:${activeServerPort}`);
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
