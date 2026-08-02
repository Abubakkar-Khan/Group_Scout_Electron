import { cookies } from "next/headers";
import { prisma } from "./db";
import { authPrisma } from "./auth-db";

export async function getSession(req?: Request) {
  try {
    let token: string | undefined;

    if (req) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/(?:session_token|better-auth\.session_token)=([^;]+)/);
      token = match ? match[1] : undefined;
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get("session_token")?.value || cookieStore.get("better-auth.session_token")?.value;
    }

    if (!token) {
      // Fallback: If no token is set, check local SQLite default user
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        return {
          user: defaultUser,
          session: { id: "default-session", userId: defaultUser.id, token: "default-token", expiresAt: new Date(Date.now() + 8640000000) },
        };
      }
      return null;
    }

    // 1. Verify session token online against Neon PostgreSQL DB
    let session = await authPrisma.session.findUnique({
      where: { token },
      include: { user: true },
    }).catch((err) => {
      console.warn("[getSession] Online Neon auth lookup failed, falling back locally:", err.message);
      return null;
    });

    if (!session || new Date(session.expiresAt) < new Date()) {
      // Fallback to local user if offline or session expired locally
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        return {
          user: defaultUser,
          session: { id: "default-session", userId: defaultUser.id, token: "default-token", expiresAt: new Date(Date.now() + 8640000000) },
        };
      }
      return null;
    }

    // 2. Ensure local SQLite has a cached record of the user and default settings for local relations
    try {
      await prisma.user.upsert({
        where: { id: session.user.id },
        update: { name: session.user.name, email: session.user.email },
        create: { id: session.user.id, name: session.user.name, email: session.user.email, emailVerified: session.user.emailVerified },
      });

      const existingSettings = await prisma.settings.findUnique({ where: { userId: session.user.id } });
      if (!existingSettings) {
        await prisma.settings.create({ data: { userId: session.user.id } }).catch(() => {});
      }
    } catch (dbErr) {
      console.error("[getSession] Local SQLite user sync error:", dbErr);
    }

    return {
      user: session.user,
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        token: session.token,
      },
    };
  } catch (error: any) {
    if (error?.digest !== "DYNAMIC_SERVER_USAGE") {
      console.error("Error in getSession:", error);
    }
    try {
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        return {
          user: defaultUser,
          session: { id: "default-session", userId: defaultUser.id, token: "default-token", expiresAt: new Date(Date.now() + 8640000000) },
        };
      }
    } catch {
      // ignore
    }
    return null;
  }
}
