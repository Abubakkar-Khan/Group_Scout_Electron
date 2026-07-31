import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const negativeKeywords = await prisma.negativeKeyword.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(negativeKeywords)
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { keyword } = await request.json()
    if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 })
    }

    const trimmed = keyword.trim()

    const negativeKeyword = await prisma.negativeKeyword.create({
      data: {
        userId: session.user.id,
        keyword: trimmed,
        enabled: true,
      },
    })

    return NextResponse.json(negativeKeyword)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Negative keyword already exists" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { enabled } = body

    const existing = await prisma.negativeKeyword.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Negative keyword not found" }, { status: 404 })
    }

    const updated = await prisma.negativeKeyword.update({
      where: { id },
      data: { enabled: Boolean(enabled) },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 })
  }

  try {
    const existing = await prisma.negativeKeyword.findUnique({ where: { id } })

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Negative keyword not found" }, { status: 404 })
    }

    await prisma.negativeKeyword.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
