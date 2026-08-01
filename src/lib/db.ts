import { PrismaClient } from "@prisma/client"
import { getDatabasePath } from "@/lib/paths"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const getPrismaInstance = () => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  if (process.env.NODE_ENV === "production" && (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("./dev.db"))) {
    const dbPath = getDatabasePath();
    process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
  }

  return new PrismaClient();
};

export const db = getPrismaInstance()
export const prisma = db

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
