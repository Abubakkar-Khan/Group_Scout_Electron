import crypto from "crypto"
import fs from "fs"
import path from "path"
import os from "os"

const ALGORITHM = "aes-256-gcm"

function getOrCreateLocalKey(): string {
  // 1. If explicitly defined in .env and is a valid 64-char hex key, use it
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.trim().length === 64) {
    return process.env.ENCRYPTION_KEY.trim()
  }

  // 2. Otherwise, auto-generate and persist a unique per-machine 256-bit key in AppData
  try {
    const appDataDir = process.env.APPDATA || (process.platform === "darwin" ? path.join(os.homedir(), "Library", "Preferences") : path.join(os.homedir(), ".config"))
    const keyDir = path.join(appDataDir, "GroupScout")
    const keyPath = path.join(keyDir, "secret.key")

    if (fs.existsSync(keyPath)) {
      const savedKey = fs.readFileSync(keyPath, "utf8").trim()
      if (savedKey.length === 64) return savedKey
    }

    const newKey = crypto.randomBytes(32).toString("hex")
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true })
    }
    fs.writeFileSync(keyPath, newKey, "utf8")
    return newKey
  } catch (err) {
    // 3. Fallback: machine-unique hash seed
    const machineSeed = `${os.hostname()}_${os.homedir()}_GroupScout_Secure_Key_Seed`
    return crypto.createHash("sha256").update(machineSeed).digest("hex")
  }
}

let cachedKey: string | null = null
function getKey(): string {
  if (!cachedKey) {
    cachedKey = getOrCreateLocalKey()
  }
  return cachedKey
}

export function encrypt(text: string): string {
  if (!text) return text
  
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, "hex"), iv)
  
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  
  const authTag = cipher.getAuthTag()
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

export function decrypt(text: string): string {
  if (!text || !text.includes(":")) return text
  
  try {
    const key = getKey()
    const parts = text.split(":")
    const iv = Buffer.from(parts[0], "hex")
    const authTag = Buffer.from(parts[1], "hex")
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, "hex"), iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    
    return decrypted
  } catch (error) {
    console.error("Decryption failed:", error)
    return ""
  }
}

