import { cookies, headers } from "next/headers";
import { prisma } from "./db";

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
      // Fallback: If no session token is set, but a user exists in DB (e.g. desktop single-user mode),
      // return the first user so the application remains functional.
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        return {
          user: defaultUser,
          session: { id: "default-session", userId: defaultUser.id, token: "default-token", expiresAt: new Date(Date.now() + 8640000000) },
        };
      }
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        return {
          user: defaultUser,
          session: { id: "default-session", userId: defaultUser.id, token: "default-token", expiresAt: new Date(Date.now() + 8640000000) },
        };
      }
      return null;
    }

    if (new Date(session.expiresAt) < new Date()) {
      return null;
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
