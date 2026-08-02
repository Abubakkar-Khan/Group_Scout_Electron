import crypto from "crypto"

const DEFAULT_KEY = crypto.createHash("sha256").update("GroupScout_Secure_Local_Key_Seed").digest("hex")
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || DEFAULT_KEY
const ALGORITHM = "aes-256-gcm"

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) return text
  
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv)
  
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  
  const authTag = cipher.getAuthTag()
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

export function decrypt(text: string): string {
  if (!ENCRYPTION_KEY || !text.includes(":")) return text
  
  try {
    const parts = text.split(":")
    const iv = Buffer.from(parts[0], "hex")
    const authTag = Buffer.from(parts[1], "hex")
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    
    return decrypted
  } catch (error) {
    console.error("Decryption failed:", error)
    return ""
  }
}
