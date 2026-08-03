import { PrismaClient } from "@prisma/client"
import path from "path"
import fs from "fs"
import os from "os"

function getLocalDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL

  // If DATABASE_URL starts with "file:" it's a valid SQLite URL
  if (envUrl && envUrl.startsWith("file:")) {
    const rawPath = envUrl.replace("file:", "")

    // If it's already absolute, use it directly
    if (path.isAbsolute(rawPath)) {
      const dir = path.dirname(rawPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      console.log("[db] Using absolute SQLite path:", rawPath)
      return `file:${rawPath}`
    }

    // Relative path: try resolving from cwd first, then from known project root
    const fromCwd = path.resolve(process.cwd(), rawPath)
    if (fs.existsSync(fromCwd)) {
      console.log("[db] Using SQLite path (resolved from cwd):", fromCwd)
      return `file:${fromCwd}`
    }

    // Check if parent dir exists (file might not exist yet but dir does)
    const fromCwdDir = path.dirname(fromCwd)
    if (fs.existsSync(fromCwdDir)) {
      console.log("[db] Using SQLite path (dir exists, file may be created):", fromCwd)
      return `file:${fromCwd}`
    }
  }

  // Fallback: use %APPDATA%/GroupScout/database.db (always works in production Electron)
  const appDataDir = process.env.APPDATA
    || (process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support")
      : path.join(os.homedir(), ".config"))
  const dbDir = path.join(appDataDir, "GroupScout")
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  const dbPath = path.join(dbDir, "database.db")
  console.log("[db] Using fallback SQLite path:", dbPath)
  return `file:${dbPath}`
}

const resolvedDbUrl = getLocalDatabaseUrl()

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: resolvedDbUrl,
      },
    },
  })
export const prisma = db

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
