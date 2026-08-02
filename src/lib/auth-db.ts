import { PrismaClient as AuthPrismaClient } from "@prisma/client-auth";

const globalForAuthPrisma = globalThis as unknown as { authPrisma: AuthPrismaClient };

export const authPrisma =
  globalForAuthPrisma.authPrisma ||
  new AuthPrismaClient({
    datasources: {
      db: {
        url: process.env.NEON_DATABASE_URL || "postgresql://neondb_owner:npg_wBXiqg87fxLN@ep-empty-bar-aouxp6cb-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForAuthPrisma.authPrisma = authPrisma;
