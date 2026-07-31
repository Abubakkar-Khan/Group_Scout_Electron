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

    const [keywordMatches, leads, totalLeads, latestSync, totalScrapedAgg, periodPostsCount, scanLogs] = await Promise.all([
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
      // Posts created in period
      prisma.post.count({
        where: {
          userId: session.user.id,
          ...dateFilter,
        }
      }),
      // SCAN_STATS logs within period
      prisma.logEvent.findMany({
        where: {
          userId: session.user.id,
          type: "SCAN_STATS",
          ...dateFilter,
        },
        select: { metadata: true }
      })
    ])

    const isConnected = latestSync && (new Date().getTime() - new Date(latestSync.createdAt).getTime()) < 60000;
    const extensionState = latestSync && latestSync.metadata ? JSON.parse(latestSync.metadata) : null;

    // Compute real dynamic total posts scanned for period
    let totalScraped = totalScrapedAgg._sum.postsScanned || 0;
    if (period !== "all") {
      let periodSum = 0;
      for (const log of scanLogs) {
        if (log.metadata) {
          try {
            const meta = JSON.parse(log.metadata);
            if (typeof meta.postsScanned === "number") {
              periodSum += meta.postsScanned;
            }
          } catch {}
        }
      }
      // If scan logs exist for period, use exact sum; otherwise fallback to posts count or all-time total
      totalScraped = periodSum > 0 ? periodSum : Math.max(periodPostsCount, Math.min(periodPostsCount, totalScraped));
    }

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
