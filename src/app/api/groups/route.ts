import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { FacebookAutomator } from "@/lib/facebook"

function extractFacebookGroupId(value: string): string | null {
  const trimmed = value.trim()
  const match = trimmed.match(/(?:m\.|www\.)?facebook\.com\/groups\/([^/?#]+)/i)
  const rawId = match?.[1] || (/^[a-zA-Z0-9_.-]+$/.test(trimmed) ? trimmed : null)
  return rawId ? decodeURIComponent(rawId).replace(/\/$/, "") : null
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const groups = await prisma.monitoredGroup.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            posts: {
              where: { createdAt: { gte: today } }
            }
          }
        }
      }
    })
    
    // Map to flat structure for frontend
    const formattedGroups = groups.map(g => ({
      ...g,
      newPostsToday: g._count.posts
    }))
    
    return NextResponse.json(formattedGroups)
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

    const facebookGroupId = extractFacebookGroupId(url)

    if (!facebookGroupId) {
      return NextResponse.json({ error: "Invalid Facebook Group URL" }, { status: 400 })
    }

    // Try to immediately scrape group name & image
    let groupName = facebookGroupId
    let iconUrl = ""

    try {
      const automator = new FacebookAutomator()
      const meta = await automator.fetchGroupMetadata(facebookGroupId)
      if (meta.name) groupName = meta.name
      if (meta.iconUrl) iconUrl = meta.iconUrl
    } catch (err) {
      console.warn(`[API Groups] Quick metadata fetch failed for ${facebookGroupId}, using fallback ID:`, err)
    }

    const group = await prisma.monitoredGroup.create({
      data: {
        userId: session.user.id,
        facebookGroupId,
        name: groupName,
        iconUrl: iconUrl || null,
        enabled: true
      }
    })
    
    return NextResponse.json(group)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Group is already being monitored" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
