import { cookies } from "next/headers";
import { prisma } from "./db";
import { authPrisma } from "./auth-db";

export async function ensureLocalUser(user: { id: string; name?: string | null; email: string; emailVerified?: boolean }) {
  // First check if user already exists by ID
  const existingById = await prisma.user.findUnique({ where: { id: user.id } });
  
  if (!existingById) {
    // User ID doesn't exist locally. Check if another local user has the same email (stale record).
    const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
    
    if (existingByEmail && existingByEmail.id !== user.id) {
      // Stale user with same email but different ID — replace it.
      // Delete old user (cascades to keywords, groups, posts, settings, etc.)
      await prisma.user.delete({ where: { id: existingByEmail.id } });
    }

    // Create the user fresh
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name || "User",
        email: user.email,
        emailVerified: user.emailVerified ?? true,
      },
    });
  } else {
    // User exists by ID — just update name/email
    await prisma.user.update({
      where: { id: user.id },
      data: { name: user.name || "User", email: user.email },
    });
  }

  // Ensure default settings exist
  const existingSettings = await prisma.settings.findUnique({ where: { userId: user.id } });
  if (!existingSettings) {
    await prisma.settings.create({ data: { userId: user.id } }).catch(() => {});
  }
}

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
    await ensureLocalUser(session.user);

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
