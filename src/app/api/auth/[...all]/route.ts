import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authPrisma } from "@/lib/auth-db";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function GET(request: Request, context: { params: Promise<{ all: string[] }> }) {
  const { all } = await context.params;
  const action = all?.[0];

  if (action === "me") {
    const session = await getSession(request);
    return NextResponse.json({ user: session?.user || null });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ all: string[] }> }) {
  const { all } = await context.params;
  const action = all?.[0];

  if (action === "login") {
    try {
      const { email, password } = await request.json();
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
      }

      // 1. Authenticate against online Neon PostgreSQL Database
      let user: any = await authPrisma.user.findUnique({ where: { email } }).catch(() => null);
      if (!user) {
        // Fallback to local user if offline or unmigrated
        user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
      }

      if (!user) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      if (user.banned) {
        return NextResponse.json({ error: "Your account has been suspended. Please contact support." }, { status: 403 });
      }

      let account = await authPrisma.account.findFirst({ where: { userId: user.id } }).catch(() => null);
      if (!account) {
        account = await prisma.account.findFirst({ where: { userId: user.id } }).catch(() => null);
      }

      if (account?.password) {
        const isValid = bcrypt.compareSync(password, account.password);
        if (!isValid) {
          return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days session life

      // Create session in online Neon PostgreSQL DB
      await authPrisma.session.create({
        data: {
          id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          userId: user.id,
          token,
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }).catch(() => {
        // Fallback local session if offline
        return prisma.session.create({
          data: {
            id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            userId: user.id,
            token,
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      });

      // Cache user locally in SQLite for local relations
      await prisma.user.upsert({
        where: { id: user.id },
        update: { name: user.name, email: user.email },
        create: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified },
      }).catch(() => {});

      const response = NextResponse.json({ user, success: true });
      response.cookies.set("session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      });
      return response;
    } catch (err: any) {
      console.error("Login error:", err);
      return NextResponse.json({ error: err.message || "Failed to sign in" }, { status: 500 });
    }
  }

  if (action === "signup") {
    try {
      const { name, email, password } = await request.json();
      if (!email || !password || !name) {
        return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
      }

      const existing = await authPrisma.user.findUnique({ where: { email } }).catch(() => null);
      if (existing) {
        return NextResponse.json({ error: "User already exists" }, { status: 400 });
      }

      const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const hashedPassword = bcrypt.hashSync(password, 10);
      const now = new Date();

      // 1. Create User in online Neon PostgreSQL Database
      const user = await authPrisma.user.create({
        data: {
          id: userId,
          name,
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      }).catch(async () => {
        // Fallback local user creation if offline
        return prisma.user.create({
          data: {
            id: userId,
            name,
            email,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          },
        });
      });

      // 2. Create Account in online Neon PostgreSQL Database
      await authPrisma.account.create({
        data: {
          id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        },
      }).catch(() => {});

      // 3. Cache user and create default settings locally in SQLite
      await prisma.user.upsert({
        where: { id: user.id },
        update: { name: user.name, email: user.email },
        create: { id: user.id, name: user.name, email: user.email, emailVerified: true },
      }).catch(() => {});

      await prisma.settings.create({
        data: {
          userId: user.id,
        },
      }).catch(() => {});

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days session life

      // Create Session in online Neon PostgreSQL DB
      await authPrisma.session.create({
        data: {
          id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          userId: user.id,
          token,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        },
      }).catch(() => {});

      const response = NextResponse.json({ user, success: true });
      response.cookies.set("session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      });
      return response;
    } catch (err: any) {
      console.error("Signup error:", err);
      return NextResponse.json({ error: err.message || "Failed to create account" }, { status: 500 });
    }
  }

  if (action === "logout") {
    const response = NextResponse.json({ success: true });
    response.cookies.set("session_token", "", { expires: new Date(0), path: "/" });
    response.cookies.set("better-auth.session_token", "", { expires: new Date(0), path: "/" });
    return response;
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
