import { NextResponse } from "next/server"
import { getSession, ensureLocalUser } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const keywords = await prisma.keyword.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(keywords)
  } catch (err: any) {
    console.error("[API Keywords GET] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch keywords" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await ensureLocalUser(session.user)

    const body = await request.json()
    const { keyword } = body

    if (!keyword) return NextResponse.json({ error: "Keyword is required" }, { status: 400 })

    const created = await prisma.keyword.create({
      data: {
        keyword,
        userId: session.user.id,
      },
    })
    return NextResponse.json(created)
  } catch (err: any) {
    console.error("[API Keywords POST] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to create keyword" }, { status: 500 })
  }
}
