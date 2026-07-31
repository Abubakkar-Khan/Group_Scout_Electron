import { chromium, BrowserContext, Page, Response } from "playwright";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(process.cwd(), "chrome-data");

export interface FacebookPost {
  postId: string;
  url: string;
  author: string;
  content: string;
  timestamp: string;
  groupId: string;
}

type JsonObject = Record<string, unknown>;

interface DomPost {
  postId: string;
  url: string;
  author: string;
  content: string;
  timestamp: string;
  groupId: string;
}

// ─── Human-like helpers ───────────────────────────────────────────────

/** Random integer between min and max (inclusive) */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Sleep for a randomised duration to mimic human pace */
function humanDelay(minMs: number = 300, maxMs: number = 800): Promise<void> {
  return new Promise((r) => setTimeout(r, randInt(minMs, maxMs)));
}

/** Smooth, human-like scroll: small increments with random pauses */
async function humanScroll(page: Page, totalPixels: number = 2000) {
  let scrolled = 0;
  while (scrolled < totalPixels) {
    // Humans scroll in bursts of 200–600px
    const chunk = randInt(200, 600);
    await page.evaluate((px) => window.scrollBy({ top: px, behavior: "smooth" }), chunk);
    scrolled += chunk;
    // Short pause between scroll bursts
    await humanDelay(200, 600);
  }
}

/** Move the mouse to a random spot on the page (mimics idle cursor movement) */
async function randomMouseMove(page: Page) {
  const x = randInt(100, 900);
  const y = randInt(150, 550);
  await page.mouse.move(x, y, { steps: randInt(3, 8) });
}

function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return `hash_${Math.abs(hash)}`;
}

function textFromMaybeMessage(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const obj = value as JsonObject;
  if (typeof obj.text === "string") return obj.text.trim();
  if (Array.isArray(obj.ranges) && typeof obj.text === "string") return obj.text.trim();
  return "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getNestedObject(value: unknown, key: string): JsonObject | null {
  if (!value || typeof value !== "object") return null;
  const nested = (value as JsonObject)[key];
  return nested && typeof nested === "object" && !Array.isArray(nested) ? nested as JsonObject : null;
}

/** Recursively search intercepted JSON for Facebook posts */
function deepExtractPosts(obj: unknown, results: FacebookPost[], groupId: string) {
  if (!obj || typeof obj !== "object") return;

  const current = obj as JsonObject;
  const message = textFromMaybeMessage(current.message) || textFromMaybeMessage(current.comet_sections);

  // Pattern: Comet story node with message
  if (message.length > 5) {
    let url = stringValue(current.url) || stringValue(current.share_url) || stringValue(current.story_url);
    let author = "Unknown";
    let postId = stringValue(current.id) || stringValue(current.post_id) || stringValue(current.legacy_fbid);

    if (Array.isArray(current.actors) && current.actors.length > 0) {
      const actor = current.actors[0] as JsonObject;
      author = stringValue(actor.name) || author;
    }

    const feedback = getNestedObject(current, "feedback");
    if (!postId && feedback) {
      postId = stringValue(feedback.subscription_target_id) || stringValue(feedback.id);
    }

    const permalink = getNestedObject(current, "permalink_url");
    if (!url && permalink) url = stringValue(permalink.url);

    if (!url && postId) {
      url = `https://www.facebook.com/groups/${groupId}/posts/${postId}`;
    }

    if (!postId) {
      postId = stableHash(`${groupId}:${message}`);
    }

    const isDuplicate = results.some(p => p.postId === postId || p.content === message);
    
    if (!isDuplicate) {
      results.push({
        postId,
        url: url || `https://www.facebook.com/groups/${groupId}`,
        author,
        content: message,
        timestamp: new Date().toISOString(),
        groupId
      });
    }
  }

  // Iterate over children (JSON.parse produces tree without cycles, so this is safe)
  for (const key of Object.keys(current)) {
    const value = current[key];
    if (value !== null && typeof value === "object") {
      deepExtractPosts(value, results, groupId);
    }
  }
}

function parseGraphqlPayload(text: string): unknown[] {
  const payloads: unknown[] = [];
  for (const part of text.split(/\r?\n/)) {
    const trimmed = part.trim().replace(/^for\s*\(;;\);/, "");
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) continue;
    try {
      payloads.push(JSON.parse(trimmed));
    } catch {
      // Facebook often mixes transport metadata and JSON fragments; ignore fragments that are not parseable.
    }
  }
  return payloads;
}

// ─── Main Automator ───────────────────────────────────────────────────

export class FacebookAutomator {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isHeadlessMode: boolean = true;

  async init(overrideHeadless?: boolean) {
    // If already initialised, reuse the existing context
    if (this.context && this.page) {
      if (!this.page.isClosed()) {
        console.log("[FacebookAutomator] Reusing existing browser session.");
        return;
      } else {
        console.log("[FacebookAutomator] Browser or page was closed. Reinitializing...");
        this.context = null;
        this.page = null;
      }
    }

    const isHeadless = overrideHeadless !== undefined ? overrideHeadless : process.env.HEADLESS !== "false";
    this.isHeadlessMode = isHeadless;

    // Use system Chrome if installed on Windows for best compatibility and saved sessions
    const useSystemChrome = fs.existsSync(CHROME_PATH);

    console.log(`[FacebookAutomator] Launching Browser (System Chrome: ${useSystemChrome}, Headless: ${isHeadless})...`);
    
    const launchOptions: any = {
      headless: isHeadless,
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
      timezoneId: "Asia/Karachi",
      args: [
        "--disable-notifications",
        "--disable-infobars",
        "--disable-blink-features=AutomationControlled",
      ],
    };

    if (useSystemChrome) {
      launchOptions.executablePath = CHROME_PATH;
    }

    this.context = await chromium.launchPersistentContext(USER_DATA_DIR, launchOptions);
    this.page = this.context.pages()[0] || await this.context.newPage();

    // Remove the tell-tale navigator.webdriver flag
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    console.log("[FacebookAutomator] Browser launched successfully.");
  }

  async checkLogin(): Promise<boolean> {
    if (!this.page) throw new Error("Not initialized");

    console.log("[FacebookAutomator] Navigating to Facebook...");
    try {
      await this.page.goto("https://www.facebook.com/", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await humanDelay(2000, 3500);
    } catch {
      console.log("[FacebookAutomator] Slow network – proceeding anyway.");
    }

    const currentUrl = this.page.url();
    const isLoginPage = await this.page.evaluate(() => {
      return (
        document.querySelector('input[name="email"]') !== null ||
        document.location.pathname.includes("/login") ||
        document.location.href.includes("facebook.com/login")
      );
    });

    if (isLoginPage) {
      console.log("[FacebookAutomator] ❌ Facebook Login required!");
      
      // If headless, re-launch in headed (visible) mode so user can log in
      if (this.isHeadlessMode) {
        console.log("[FacebookAutomator] 🔑 Opening visible Chrome window for manual Facebook login...");
        await this.close();
        await this.init(false); // Force headed (visible) mode
        if (!this.page) return false;
        await this.page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded" });
      }

      console.log("[FacebookAutomator] ⏳ Waiting up to 120s for Facebook login completion...");

      try {
        await this.page.waitForURL((url) => !url.toString().includes("/login"), {
          timeout: 120000,
        });
        await humanDelay(3000, 5000);
        console.log("[FacebookAutomator] ✅ Facebook Login detected!");
        
        // Switch back to headless mode for silent background operation
        await this.close();
        await this.init(true);
        return true;
      } catch {
        console.log("[FacebookAutomator] ❌ Login timeout or window closed.");
        return false;
      }
    }

    console.log("[FacebookAutomator] ✅ Logged into Facebook. Current URL:", currentUrl);
    return true;
  }

  async openLoginWindow(): Promise<boolean> {
    console.log("[FacebookAutomator] Manually opening Facebook login window...");
    await this.close();
    await this.init(false); // Open visible window
    if (!this.page) return false;
    await this.page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded" });
    return true;
  }

  async scanGroup(groupId: string, maxPosts: number = 15, scrollDepth: number = 5): Promise<{ posts: FacebookPost[], groupName: string, iconUrl: string }> {
    if (!this.page) throw new Error("Not initialized");

    const groupUrl = `https://www.facebook.com/groups/${groupId}?sorting_setting=CHRONOLOGICAL`;
    console.log(`[FacebookAutomator] Navigating to group: ${groupId}`);
    
    const interceptedPosts: FacebookPost[] = [];
    
    // Set up GraphQL network interceptor
    const graphqlHandler = async (response: Response) => {
      try {
        if (response.url().includes('/api/graphql/') && response.request().method() === 'POST') {
          const text = await response.text();
          for (const json of parseGraphqlPayload(text)) {
            deepExtractPosts(json, interceptedPosts, groupId);
          }
        }
      } catch {
        // Ignore parse errors silently
      }
    };
    
    this.page.on('response', graphqlHandler);

    try {
      // Navigate like a human would – click a link, wait for it to load
      await this.page.goto(groupUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Human pause: "looking at the page loading" (speed up)
      await humanDelay(800, 1500);

      // Remove annoying popups, login walls, and cookie banners
      await this.page.evaluate(() => {
        // 1. Remove dialogs
        document.querySelectorAll('[role="dialog"]').forEach(el => el.remove());
        
        // 2. Click any visible close buttons or cookie accepts
        document.querySelectorAll('[aria-label="Close"], [aria-label="Allow all cookies"], [aria-label="Decline optional cookies"]').forEach(btn => {
          try { (btn as HTMLElement).click(); } catch {}
        });

        // 3. Find and destroy translucent fixed/absolute overlays (the "light layer")
        document.querySelectorAll('div').forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'absolute') {
            const bg = style.backgroundColor;
            if (bg.startsWith('rgba(')) {
              const parts = bg.replace('rgba(', '').replace(')', '').split(',');
              if (parts.length === 4) {
                const alpha = parseFloat(parts[3]);
                // If it's semi-transparent (like Facebook's grey login backdrop), nuke it
                if (alpha > 0 && alpha < 1) {
                  el.remove();
                }
              }
            }
          }
        });

        // 4. Force restore scrolling (Facebook locks the scroll when the login wall appears)
        document.body.style.setProperty('overflow', 'auto', 'important');
        document.body.style.setProperty('position', 'static', 'important');
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
        
        // Also forcibly un-hide any hidden wrappers
        document.querySelectorAll('div').forEach(w => {
           if (window.getComputedStyle(w).overflow === 'hidden' && w.clientHeight > window.innerHeight * 0.8) {
               w.style.setProperty('overflow', 'visible', 'important');
               w.style.setProperty('overflow-y', 'auto', 'important');
           }
        });
      });

      // Move mouse as if orienting on the page
      await randomMouseMove(this.page);

      // Extract group header info (Name & Icon)
      const groupInfo = await this.page.evaluate(() => {
        let name = "";
        let icon = "";
        
        // Find H1 for group name
        const h1 = document.querySelector('h1');
        if (h1) name = h1.innerText.trim();
        
        // Find image by Facebook's specific profileCoverPhoto attribute
        const exactCover = document.querySelector('img[data-imgperflogname="profileCoverPhoto"]');
        if (exactCover) {
          icon = exactCover.getAttribute('src') || "";
        } else {
          // Fallback to looking for images with alt matching the group name or containing 'cover'
          const images = Array.from(document.querySelectorAll('img'));
          const coverImg = images.find(img => img.getAttribute('alt')?.includes(name) || img.getAttribute('alt')?.toLowerCase().includes('cover'));
          if (coverImg) icon = coverImg.getAttribute('src') || "";
        }
        
        return { name, icon };
      });

      // Wait for at least one post to appear
      const feedLoaded = await this.page
        .waitForSelector('div[role="feed"], div[role="article"]', { timeout: 15000 })
        .catch(() => null);

      if (!feedLoaded) {
        console.log(`[FacebookAutomator] No feed found for group ${groupId}. Might be private or empty.`);
        return { posts: [], groupName: groupInfo.name, iconUrl: groupInfo.icon };
      }

      // Scroll like a human browsing through the feed to trigger GraphQL requests
      const scrollSessions = Math.max(2, Math.min(8, scrollDepth || 5));
      for (let i = 0; i < scrollSessions; i++) {
        await humanScroll(this.page, randInt(1200, 2400));
        await humanDelay(500, 1000);
        
        // Expand "See more" buttons on posts
        await this.page.evaluate(() => {
          document.querySelectorAll('div[role="button"]').forEach(btn => {
            const text = btn.textContent?.trim().toLowerCase();
            if (text === "see more" || text === "read more" || text === "see translation") {
              try { (btn as HTMLElement).click(); } catch (e) {}
            }
          });
        });

        if (Math.random() > 0.7) {
          await randomMouseMove(this.page);
        }
      }

      // Small pause to allow final GraphQL responses to arrive and be parsed
      await humanDelay(1500, 2500);

      console.log(`[FacebookAutomator] Intercepted ${interceptedPosts.length} posts via GraphQL for group ${groupId}`);

      // ─── Extract posts from the DOM (Fallback Method) ─────────────────────────────
      const domPosts = await this.page.evaluate(({ groupId }: { groupId: string }) => {
        type ExtractedPost = {
          postId: string;
          url: string;
          author: string;
          content: string;
          timestamp: string;
          groupId: string;
        };

        const noise = new Set([
          "all reactions:",
          "comment",
          "comments",
          "follow",
          "join group",
          "like",
          "more",
          "reply",
          "see less",
          "see more",
          "send",
          "share",
          "view more comments",
        ]);

        const cleanLine = (line: string) => line.replace(/\s+/g, " ").trim();
        const isUsefulLine = (line: string) => {
          const normalized = cleanLine(line).toLowerCase();
          if (normalized.length < 4) return false;
          if (noise.has(normalized)) return false;
          if (/^\d+[dhms]$/.test(normalized)) return false;
          if (/^\d+\s*(comments?|shares?)$/.test(normalized)) return false;
          return true;
        };

        const hashContent = (value: string) => {
          let hash = 0;
          for (let i = 0; i < value.length; i++) {
            hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
          }
          return `hash_${Math.abs(hash)}`;
        };

        const absoluteFacebookUrl = (href: string) => {
          const cleanHref = href.split("?")[0];
          return cleanHref.startsWith("http") ? cleanHref : `https://www.facebook.com${cleanHref}`;
        };

        const articles = Array.from(document.querySelectorAll('div[role="article"]'));
        const results: ExtractedPost[] = [];
        const seenContent = new Set<string>();

        for (const el of articles) {
          try {
            // ── Content extraction ──
            let content = "";

            // Strategy 1: Facebook's ad preview message container
            const adPreview = el.querySelector('[data-ad-preview="message"]');
            if (adPreview) {
              content = (adPreview as HTMLElement).innerText.trim();
            }

            // Strategy 2: All dir="auto" divs (Facebook wraps text in these)
            if (!content || content.length < 10) {
              const autoDivs = Array.from(el.querySelectorAll('div[dir="auto"]'));
              const parts: string[] = [];
              for (const div of autoDivs) {
                const text = cleanLine((div as HTMLElement).innerText || "");
                if (isUsefulLine(text) && !parts.includes(text)) {
                  parts.push(text);
                }
              }
              content = parts.join(" ").trim();
            }

            // Strategy 3: Fallback to entire article text minus known UI noise
            if (!content || content.length < 10) {
              const fullText = (el as HTMLElement).innerText || "";
              content = fullText
                .split("\n")
                .map(cleanLine)
                .filter(isUsefulLine)
                .slice(0, 12)
                .join(" ")
                .substring(0, 1000)
                .trim();
            }

            if (!content || content.length < 10) continue;

            const fingerprint = content.substring(0, 80).toLowerCase();
            if (seenContent.has(fingerprint)) continue;
            seenContent.add(fingerprint);

            // ── URL & Timestamp extraction ──
            let url = "";
            const timestamp = new Date().toISOString();

            const allLinks = Array.from(el.querySelectorAll("a[href]"));

            // Look for permalink-style links
            const postLink = allLinks.find((a) => {
              const href = a.getAttribute("href") || "";
              return (
                (href.includes("/groups/") &&
                  (href.includes("/posts/") || href.includes("/permalink/"))) ||
                href.includes("/story.php")
              );
            });

            if (postLink) {
              const rawHref = postLink.getAttribute("href") || "";
              url = absoluteFacebookUrl(rawHref);
            }

            // ── Post ID extraction ──
            let postId = "";
            const idMatch = url.match(/\/(?:posts|permalink)\/(\d+)/);
            const storyMatch = url.match(/story_fbid=(\d+)/);
            if (idMatch) {
              postId = idMatch[1];
            } else if (storyMatch) {
              postId = storyMatch[1];
            } else {
              postId = hashContent(`${groupId}:${content}`);
            }

            // ── Author extraction ──
            let author = "Unknown";

            // Strategy 1: The first <strong> or heading inside the article (usually author name)
            const strongEl = el.querySelector("h2 strong, h3 strong, h4 strong, strong a");
            if (strongEl) {
              const name = (strongEl as HTMLElement).innerText.trim();
              if (name.length > 1 && name.length < 60) author = name;
            }

            // Strategy 2: First link that points to a user profile
            if (author === "Unknown") {
              const profileLink = allLinks.find((a) => {
                const href = a.getAttribute("href") || "";
                const text = (a as HTMLElement).innerText.trim();
                return (
                  text.length > 1 &&
                  text.length < 50 &&
                  !href.includes("/groups/") &&
                  !href.includes("/photo") &&
                  !href.includes("/video") &&
                  !href.includes("#") &&
                  (href.includes("facebook.com/") || href.startsWith("/"))
                );
              });
              if (profileLink) {
                author = (profileLink as HTMLElement).innerText.trim();
              }
            }

            results.push({
              postId,
              url: url || `https://www.facebook.com/groups/${groupId}`,
              author,
              content: content.substring(0, 2000), // Cap content length
              timestamp,
              groupId,
            });
          } catch {
            // Silently skip malformed articles
          }
        }

        return results;
      }, { groupId });

      // Clean up GraphQL listener so it doesn't leak
      this.page.off('response', graphqlHandler);

      // Merge intercepted posts and dom posts, giving priority to intercepted ones
      const allPosts = [...interceptedPosts];
      for (const domPost of domPosts as DomPost[]) {
        if (!allPosts.find(p => p.postId === domPost.postId || p.content === domPost.content)) {
          allPosts.push(domPost);
        }
      }

      console.log(`[FacebookAutomator] Extracted ${allPosts.length} posts from group ${groupId}`);
      return { posts: allPosts.slice(0, maxPosts), groupName: groupInfo.name, iconUrl: groupInfo.icon };
    } catch (error) {
      console.error(`[FacebookAutomator] Error scanning group ${groupId}:`, error);
      // Ensure listener is cleaned up even on error
      if (this.page) {
        try { this.page.off('response', graphqlHandler); } catch {}
      }
      return { posts: [], groupName: "", iconUrl: "" };
    }
  }

  async fetchGroupMetadata(groupId: string): Promise<{ name: string; iconUrl: string }> {
    if (!this.page || this.page.isClosed()) {
      await this.init();
    }
    if (!this.page) return { name: groupId, iconUrl: "" };

    const groupUrl = `https://www.facebook.com/groups/${groupId}`;
    console.log(`[FacebookAutomator] Fetching metadata immediately for group: ${groupId}`);
    
    try {
      await this.page.goto(groupUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await humanDelay(400, 800);

      const info = await this.page.evaluate(() => {
        let name = "";
        let icon = "";
        
        const h1 = document.querySelector('h1');
        if (h1) name = h1.innerText.trim();
        
        const exactCover = document.querySelector('img[data-imgperflogname="profileCoverPhoto"]');
        if (exactCover) {
          icon = exactCover.getAttribute('src') || "";
        } else {
          const images = Array.from(document.querySelectorAll('img'));
          const coverImg = images.find(img => (name && img.getAttribute('alt')?.includes(name)) || img.getAttribute('alt')?.toLowerCase().includes('cover'));
          if (coverImg) icon = coverImg.getAttribute('src') || "";
        }
        
        return { name, icon };
      });

      return { name: info.name || groupId, iconUrl: info.icon || "" };
    } catch (e) {
      console.error(`[FacebookAutomator] Error fetching metadata for group ${groupId}:`, e);
      return { name: groupId, iconUrl: "" };
    }
  }

  async close() {
    if (this.context) {
      console.log("[FacebookAutomator] Closing Chromium...");
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }
}
