import { PrismaClient as AuthPrismaClient } from "@prisma/client-auth";

const globalForAuthPrisma = globalThis as unknown as { authPrisma: AuthPrismaClient };

export const authPrisma =
  globalForAuthPrisma.authPrisma ||
  new AuthPrismaClient({
    datasources: {
      db: {
        url: process.env.NEON_DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForAuthPrisma.authPrisma = authPrisma;
