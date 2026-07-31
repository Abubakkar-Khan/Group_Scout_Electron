
import type { Keyword, MonitoredGroup, Settings, User } from "@prisma/client";
import { FacebookAutomator, FacebookPost } from "./facebook";
import { getGroqClient, classifyPost } from "./groq";
import { prisma } from "./db";
import { findBestKeywordMatch } from "./lead-matching";

const automator = new FacebookAutomator();
let isRunning = false;

/** Random delay between min and max milliseconds */
function engineDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

async function processPostsInBackground(
  posts: FacebookPost[],
  user: Pick<User, "id">,
  keywords: Pick<Keyword, "keyword">[],
  settings: Settings,
  groups: Pick<MonitoredGroup, "id" | "facebookGroupId">[]
): Promise<{ matchCount: number; savedCount: number }> {
  let matchCount = 0;
  let savedCount = 0;

  for (const post of posts) {
    const trimmedContent = post.content.trim();
    if (!trimmedContent) continue;

    // Skip duplicates
    const existing = await prisma.post.findFirst({
      where: { facebookPostId: post.postId, userId: user.id },
    });
    if (existing) continue;

    // Keyword matching
    const matched = findBestKeywordMatch(trimmedContent, keywords);
    if (!matched) continue;

    matchCount++;
    console.log(`[Engine] Keyword "${matched.keyword}" matched in post ${post.postId.substring(0, 12)}...`);

    // Groq classification
    let isRelevant = false;
    if (settings.useGroq && settings.groqApiKey) {
      try {
        const groq = getGroqClient(settings.groqApiKey);
        isRelevant = await classifyPost(groq, matched.keyword, trimmedContent, settings.groqSystemPrompt);
        // Small delay between API calls to respect rate limits
        await engineDelay(500, 1500);
      } catch (error) {
        console.error(`[Engine] Groq error:`, error);
        isRelevant = true; // If Groq fails, save as relevant anyway
      }
    } else {
      isRelevant = true; // No Groq = all keyword matches are leads
    }

    console.log(`[Engine] Post ${post.postId.substring(0, 12)}... -> ${isRelevant ? "LEAD" : "Ignored"}`);

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
    }
  }

  if (posts.length > 0) {
    console.log(`[Engine] Background processing complete for ${posts[0].groupId}. ${matchCount} matched, ${savedCount} saved.`);
  }

  return { matchCount, savedCount };
}

async function runScan() {
  if (isRunning) {
    console.log("[Engine] Scan already in progress. Skipping.");
    return;
  }

  isRunning = true;
  console.log(`\n--- [Engine] Starting scan at ${new Date().toLocaleTimeString()} ---`);

  try {
    // 1. Fetch user data
    const user = await prisma.user.findFirst({
      include: {
        settings: true,
        keywords: { where: { enabled: true } },
        groups: { where: { enabled: true } },
      },
    });

    if (!user || !user.settings) {
      console.log("[Engine] No user or settings found.");
      return;
    }

    const { settings, keywords, groups } = user;

    if (groups.length === 0) {
      console.log("[Engine] No enabled groups. Add groups in the dashboard.");
      return;
    }

    if (keywords.length === 0) {
      console.log("[Engine] No enabled keywords. Add keywords in the dashboard.");
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
      console.log(`[Engine] Outside active hours (${settings.activeFrom}-${settings.activeTo}). Sleeping.`);
      await automator.close();
      return;
    }

    // 3. Launch browser (reuses session if already open)
    await automator.init();
    const loggedIn = await automator.checkLogin();
    if (!loggedIn) {
      console.log("[Engine] Facebook login is required before scanning can continue.");
      return;
    }

    // 4. Scan each group with human-like pauses between them
    let totalPostsScraped = 0;
    let totalPostsSaved = 0;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      console.log(`[Engine] Scanning group ${i + 1}/${groups.length}: ${group.name || group.facebookGroupId}`);

      const maxPosts = Math.max(15, Math.min(75, settings.autoScrollPages * 10));
      const { posts, groupName, iconUrl } = await automator.scanGroup(
        group.facebookGroupId,
        maxPosts,
        settings.autoScrollPages
      );
      totalPostsScraped += posts.length;

      // Update group stats
      const updateData: any = {
        lastScan: new Date(),
        postsScanned: { increment: posts.length },
        ...(groupName ? { name: groupName } : {})
      };
      
      try {
        // Try to update with iconUrl first
        await prisma.monitoredGroup.update({
          where: { id: group.id },
          data: {
            ...updateData,
            ...(iconUrl ? { iconUrl } : {})
          },
        });
      } catch (prismaError: any) {
        // If Prisma client is outdated (hasn't been regenerated) and doesn't know about iconUrl yet,
        // fallback to updating without it to prevent the engine from crashing.
        if (prismaError.message && prismaError.message.includes('iconUrl')) {
          console.warn(`[Engine] Skipped saving iconUrl for ${group.id} because Prisma client is outdated. Please run 'npx prisma generate' and restart your Next.js server.`);
          await prisma.monitoredGroup.update({
            where: { id: group.id },
            data: updateData,
          });
        } else {
          throw prismaError;
        }
      }

      if (posts.length > 0) {
        const result = await processPostsInBackground(posts, user, keywords, settings, groups);
        totalPostsSaved += result.savedCount;
      }

      // Crisp, efficient pause between groups (1.5s–3s)
      if (i < groups.length - 1) {
        const pauseSec = Math.floor(Math.random() * 2) + 1;
        console.log(`[Engine] Moving to next group in ${pauseSec}s...`);
        await engineDelay(1500, 3000);
      }
    }

    console.log(`--- [Engine] Scraping complete. ${totalPostsScraped} posts scraped, ${totalPostsSaved} posts saved. Chrome remains open. ---\n`);

  } catch (error) {
    console.error("[Engine] Error during scan (Chrome will stay open):", error);
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
