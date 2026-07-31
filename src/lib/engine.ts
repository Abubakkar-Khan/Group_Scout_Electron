
import type { Keyword, MonitoredGroup, Settings, User } from "@prisma/client";
import { FacebookAutomator, FacebookPost } from "./facebook";
import { getGroqClient, classifyPost } from "./groq";
import { prisma } from "./db";
import { findBestKeywordMatch } from "./lead-matching";

const automator = new FacebookAutomator();
let isRunning = false;

/** Log event helper to write persistent events to the database for UI display */
async function logEngineEvent(userId: string, type: "INFO" | "WARN" | "ERROR" | "SUCCESS", message: string, metadata?: any) {
  console.log(`[Engine:${type}] ${message}`);
  try {
    await prisma.logEvent.create({
      data: {
        userId,
        type,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }
    });
  } catch (err) {
    console.error("[Engine] Failed to save log event to DB:", err);
  }
}

/** Random delay between min and max milliseconds */
function engineDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

async function processPostsInBackground(
  posts: FacebookPost[],
  user: Pick<User, "id">,
  keywords: Pick<Keyword, "keyword">[],
  negativeKeywords: Pick<Keyword, "keyword">[],
  settings: Settings,
  groups: Pick<MonitoredGroup, "id" | "facebookGroupId">[]
): Promise<{ matchCount: number; savedCount: number }> {
  let matchCount = 0;
  let savedCount = 0;

  const maxAgeHours = settings.maxPostAgeHours || 48;
  const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;

  for (const post of posts) {
    const trimmedContent = post.content.trim();
    if (!trimmedContent) continue;

    // Filter out posts older than maxPostAgeHours
    if (post.timestamp) {
      const postTime = new Date(post.timestamp).getTime();
      if (!isNaN(postTime) && postTime < cutoffTime) {
        continue;
      }
    }

    // Skip duplicates
    const existing = await prisma.post.findFirst({
      where: { facebookPostId: post.postId, userId: user.id },
    });
    if (existing) continue;

    // Keyword matching with negative keyword exclusion
    const matched = findBestKeywordMatch(trimmedContent, keywords, negativeKeywords);
    if (!matched) continue;

    matchCount++;
    await logEngineEvent(user.id, "INFO", `Keyword "${matched.keyword}" matched post in group ${post.groupId}`);

    // Groq classification
    let isRelevant = false;
    if (settings.useGroq && settings.groqApiKey) {
      try {
        const groq = getGroqClient(settings.groqApiKey);
        isRelevant = await classifyPost(groq, matched.keyword, trimmedContent, settings.groqSystemPrompt);
        await engineDelay(500, 1500);
      } catch (error: any) {
        console.error(`[Engine] Groq error:`, error);
        isRelevant = true;
      }
    } else {
      isRelevant = true; // No Groq = all keyword matches are leads
    }

    // Save to database
    const groupDb = groups.find((g) => g.facebookGroupId === post.groupId);
    if (groupDb) {
      await prisma.post.create({
        data: {
          userId: user.id,
          facebookPostId: post.postId,
          groupId: groupDb.id,
          keyword: matched.keyword,
          content: trimmedContent,
          url: post.url,
          relevant: isRelevant,
          viewed: false,
        },
      });
      savedCount++;
      await logEngineEvent(user.id, "SUCCESS", `New lead saved! Keyword: "${matched.keyword}"`, { url: post.url });
    }
  }

  if (posts.length > 0) {
    console.log(`[Engine] Processing complete for ${posts[0].groupId}. ${matchCount} matched, ${savedCount} saved.`);
  }

  return { matchCount, savedCount };
}

async function runScan() {
  if (isRunning) {
    console.log("[Engine] Scan already in progress. Skipping.");
    return;
  }

  isRunning = true;

  try {
    // 1. Fetch user data with negative keywords
    const user = await prisma.user.findFirst({
      include: {
        settings: true,
        keywords: { where: { enabled: true } },
        negativeKeywords: { where: { enabled: true } },
        groups: { where: { enabled: true } },
      },
    });

    if (!user || !user.settings) {
      console.log("[Engine] No user or settings found.");
      return;
    }

    const { settings, keywords, negativeKeywords, groups } = user;

    // Auto-cleanup viewed posts older than autoDeleteViewedDays
    const retentionDays = settings.autoDeleteViewedDays || 30;
    const deleteCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    try {
      const deleted = await prisma.post.deleteMany({
        where: {
          userId: user.id,
          viewed: true,
          createdAt: { lt: deleteCutoff }
        }
      });
      if (deleted.count > 0) {
        await logEngineEvent(user.id, "INFO", `Auto-cleaned ${deleted.count} viewed lead(s) older than ${retentionDays} days.`);
      }
    } catch (cleanErr) {
      console.error("[Engine] Auto-cleanup error:", cleanErr);
    }

    if (groups.length === 0) {
      await logEngineEvent(user.id, "WARN", "No enabled groups to scan. Add Facebook Groups in dashboard.");
      return;
    }

    if (keywords.length === 0) {
      await logEngineEvent(user.id, "WARN", "No enabled keywords to monitor. Add Keywords in dashboard.");
      return;
    }

    // 2. Check active time window
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const parseTime = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const startTime = parseTime(settings.activeFrom || "00:00");
    const endTime = parseTime(settings.activeTo || "23:59");
    const insideWindow =
      startTime <= endTime
        ? currentMinutes >= startTime && currentMinutes <= endTime
        : currentMinutes >= startTime || currentMinutes <= endTime;

    if (!insideWindow) {
      await logEngineEvent(user.id, "INFO", `Outside designated active hours (${settings.activeFrom}-${settings.activeTo}). Standing by.`);
      await automator.close();
      return;
    }

    await logEngineEvent(user.id, "INFO", `Starting background scan across ${groups.length} Facebook group(s)...`);

    // 3. Launch browser (reuses session if already open)
    await automator.init();
    const loggedIn = await automator.checkLogin();
    if (!loggedIn) {
      await logEngineEvent(user.id, "WARN", "Facebook authentication required. Please click 'Log In / Verify Facebook Session' in Settings.");
      return;
    }

    // 4. Scan each group with human-like pauses between them
    let totalPostsScraped = 0;
    let totalPostsSaved = 0;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const groupDisplayName = group.name || group.facebookGroupId;
      await logEngineEvent(user.id, "INFO", `Scanning group (${i + 1}/${groups.length}): ${groupDisplayName}`);

      const maxPosts = Math.max(15, Math.min(75, settings.autoScrollPages * 10));
      const { posts, groupName, iconUrl } = await automator.scanGroup(
        group.facebookGroupId,
        maxPosts,
        settings.autoScrollPages,
        settings.scrollSpeed || "medium"
      );
      totalPostsScraped += posts.length;

      await logEngineEvent(user.id, "INFO", `Extracted ${posts.length} post(s) from ${groupDisplayName}`);

      // Update group stats
      const updateData: any = {
        lastScan: new Date(),
        postsScanned: { increment: posts.length },
        ...(groupName ? { name: groupName } : {})
      };
      
      try {
        await prisma.monitoredGroup.update({
          where: { id: group.id },
          data: {
            ...updateData,
            ...(iconUrl ? { iconUrl } : {})
          },
        });
      } catch (prismaError: any) {
        if (prismaError.message && prismaError.message.includes('iconUrl')) {
          await prisma.monitoredGroup.update({
            where: { id: group.id },
            data: updateData,
          });
        } else {
          throw prismaError;
        }
      }

      if (posts.length > 0) {
        const result = await processPostsInBackground(posts, user, keywords, negativeKeywords, settings, groups);
        totalPostsSaved += result.savedCount;
      }

      // Pause between groups according to user's interGroupDelaySeconds setting
      if (i < groups.length - 1) {
        const delaySec = settings.interGroupDelaySeconds || 3;
        await engineDelay(delaySec * 1000, (delaySec + 1.5) * 1000);
      }
    }

    await logEngineEvent(user.id, "SUCCESS", `Scan completed. ${totalPostsScraped} post(s) checked, ${totalPostsSaved} new lead(s) captured.`);

  } catch (error: any) {
    console.error("[Engine] Error during scan:", error);
  } finally {
    isRunning = false;
  }
}

// ─── Engine Control (globalThis survives Next.js HMR) ─────────────────

const globalAny = globalThis as typeof globalThis & {
  engineInterval?: ReturnType<typeof setInterval> | null;
  lastRunTimestamp?: number;
  wasInsideWindow?: boolean;
};

export function startEngine() {
  if (globalAny.engineInterval) {
    console.log("[Engine] Background scheduler already active.");
    return { status: "running" };
  }

  console.log("[Engine] Background scheduler started automatically.");
  globalAny.lastRunTimestamp = 0; // Force immediate check on start
  globalAny.wasInsideWindow = false;

  // Run initial check immediately
  runScan();

  // Check every 30 seconds for precise designated time window triggering
  globalAny.engineInterval = setInterval(async () => {
    try {
      const user = await prisma.user.findFirst({ include: { settings: true } });
      if (!user || !user.settings) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const parseTime = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      const startTime = parseTime(user.settings.activeFrom || "00:00");
      const endTime = parseTime(user.settings.activeTo || "23:59");
      
      const insideWindow =
        startTime <= endTime
          ? currentMinutes >= startTime && currentMinutes <= endTime
          : currentMinutes >= startTime || currentMinutes <= endTime;

      const intervalMs = user.settings.scanInterval * 60 * 1000;
      const nowMs = Date.now();
      const lastRun = globalAny.lastRunTimestamp || 0;

      // Auto-trigger scan if we just entered the designated active time window OR if interval has passed
      const justEnteredWindow = insideWindow && !globalAny.wasInsideWindow;
      const intervalPassed = nowMs - lastRun >= intervalMs;

      globalAny.wasInsideWindow = insideWindow;

      if (insideWindow && (justEnteredWindow || intervalPassed)) {
        if (justEnteredWindow) {
          console.log(`[Engine] ⏰ Designated active time arrived (${user.settings.activeFrom} - ${user.settings.activeTo}). Auto-starting scan!`);
        }
        globalAny.lastRunTimestamp = nowMs;
        await runScan();
      }
    } catch (error) {
      console.error("[Engine] Scheduler check error:", error);
    }
  }, 30000);

  return { status: "running" };
}

export function ensureEngineRunning() {
  if (!globalAny.engineInterval) {
    startEngine();
  }
}

export function stopEngine() {
  if (globalAny.engineInterval) {
    clearInterval(globalAny.engineInterval);
    globalAny.engineInterval = null;
    console.log("[Engine] Stopped.");
  }
  automator.close().catch(() => {});
  return { status: "stopped" };
}

export function openLoginWindow() {
  return automator.openLoginWindow();
}

export function getEngineStatus() {
  return globalAny.engineInterval ? "running" : "stopped";
}
