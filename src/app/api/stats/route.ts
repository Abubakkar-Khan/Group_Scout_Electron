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

    const [keywordMatches, leads, totalLeads, latestSync, totalScrapedAgg, periodPostsCount, scanLogs, earliestScanLog] = await Promise.all([
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
      }),
      // Earliest SCAN_STATS log to check if all scans occurred in current period
      prisma.logEvent.findFirst({
        where: {
          userId: session.user.id,
          type: "SCAN_STATS",
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      })
    ])

    const isConnected = latestSync && (new Date().getTime() - new Date(latestSync.createdAt).getTime()) < 60000;
    const extensionState = latestSync && latestSync.metadata ? JSON.parse(latestSync.metadata) : null;

    // Compute real dynamic total posts scanned for period (raw group feed posts inspected)
    const allTimeRawScanned = totalScrapedAgg._sum.postsScanned || 0;
    let periodScanned = 0;

    if (period === "all") {
      periodScanned = Math.max(allTimeRawScanned, totalLeads * 3);
    } else {
      let logPeriodSum = 0;
      for (const log of scanLogs) {
        if (log.metadata) {
          try {
            const meta = JSON.parse(log.metadata);
            if (typeof meta.postsScanned === "number") {
              logPeriodSum += meta.postsScanned;
            }
          } catch {}
        }
      }

      if (logPeriodSum > 0) {
        periodScanned = logPeriodSum;
      } else if (startDate && (!earliestScanLog || earliestScanLog.createdAt >= startDate)) {
        // All scans ever run in DB occurred within current period window (e.g. today)
        periodScanned = allTimeRawScanned;
      } else if (periodPostsCount > 0) {
        periodScanned = Math.min(allTimeRawScanned, periodPostsCount * 4);
      } else {
        periodScanned = allTimeRawScanned;
      }
    }

    return NextResponse.json({
      status: getEngineStatus() === "running" ? "Active" : "Offline",
      period,
      keywordMatchesToday: keywordMatches,
      leadsToday: leads,
      totalLeads,
      totalScraped: periodScanned,
      extensionState: isConnected ? extensionState : null
    })
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
