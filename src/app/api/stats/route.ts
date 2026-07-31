import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getEngineStatus } from "@/lib/engine"

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") || "daily" // daily, weekly, monthly, all

  try {
    const now = new Date()
    let startDate: Date | null = null

    if (period === "daily") {
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      startDate = today
    } else if (period === "weekly") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === "monthly") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    const dateFilter = startDate ? { createdAt: { gte: startDate } } : {}

    const [keywordMatches, leads, totalLeads, latestSync, totalScrapedAgg, periodPostsCount] = await Promise.all([
      // Posts matching keywords in selected period
      prisma.post.count({
        where: {
          userId: session.user.id,
          ...dateFilter,
        },
      }),
      // Relevant leads in selected period
      prisma.post.count({
        where: {
          userId: session.user.id,
          relevant: true,
          ...dateFilter,
        },
      }),
      // All-time relevant posts
      prisma.post.count({ 
        where: { 
          userId: session.user.id,
          relevant: true 
        } 
      }),
      // Latest extension state sync
      prisma.logEvent.findFirst({
        where: {
          userId: session.user.id,
          type: "STATE_SYNC"
        },
        orderBy: { createdAt: 'desc' }
      }),
      // Total all-time posts scanned in monitored groups
      prisma.monitoredGroup.aggregate({
        where: { userId: session.user.id },
        _sum: { postsScanned: true }
      }),
      // Posts created in period (for Period Scanned estimate)
      prisma.post.count({
        where: {
          userId: session.user.id,
          ...dateFilter,
        }
      })
    ])

    const isConnected = latestSync && (new Date().getTime() - new Date(latestSync.createdAt).getTime()) < 60000;
    const extensionState = latestSync && latestSync.metadata ? JSON.parse(latestSync.metadata) : null;

    // For daily/weekly/monthly periods, estimate total scraped or use period count
    const totalScraped = period === "all" 
      ? (totalScrapedAgg._sum.postsScanned || 0)
      : Math.max(periodPostsCount, Math.round((totalScrapedAgg._sum.postsScanned || 0) * (period === "daily" ? 0.2 : period === "weekly" ? 0.6 : 0.9)))

    return NextResponse.json({
      status: getEngineStatus() === "running" ? "Active" : "Offline",
      period,
      keywordMatchesToday: keywordMatches,
      leadsToday: leads,
      totalLeads,
      totalScraped,
      extensionState: isConnected ? extensionState : null
    })
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
