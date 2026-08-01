import path from "path";
import fs from "fs";

export function getUserDataDir(): string {
  const base = process.env.APPDATA || (process.platform === 'darwin' ? (process.env.HOME ? path.join(process.env.HOME, 'Library', 'Preferences') : '') : (process.env.HOME ? path.join(process.env.HOME, '.local', 'share') : ''));
  if (base) {
    const dir = path.join(base, "GroupScout");
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    }
    return dir;
  }
  return process.cwd();
}

export function getChromeDataDir(): string {
  const appData = getUserDataDir();
  const chromeDir = path.join(appData, "chrome-data");
  if (!fs.existsSync(chromeDir)) {
    try { fs.mkdirSync(chromeDir, { recursive: true }); } catch {}
  }
  return chromeDir;
}

export function getDatabasePath(): string {
  const appData = getUserDataDir();
  return path.join(appData, "database.db");
}
