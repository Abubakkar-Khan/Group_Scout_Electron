import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatExternalUrl(url: string | null | undefined): string {
  if (!url || url === "#") return "#";

  let targetUrl = url.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = `https://www.facebook.com${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
  }

  // 1. Extract Group ID and Post ID if present
  const groupMatch = targetUrl.match(/\/groups\/([^/?#]+)/);
  const groupId = groupMatch ? groupMatch[1] : "";

  // 2. Decode base64 Uzpf tokens if present
  let postId = "";
  const tokenMatch = targetUrl.match(/Uzpf[A-Za-z0-9_-]+/);
  if (tokenMatch) {
    try {
      const decoded = Buffer.from(tokenMatch[0], "base64").toString("utf8");
      const idMatch = decoded.match(/VK:(\d+)/i) || decoded.match(/:(\d+)$/);
      if (idMatch && idMatch[1]) {
        postId = idMatch[1];
      }
    } catch {}
  }

  if (!postId) {
    const postMatch = targetUrl.match(/\/(?:posts|permalink|multi_permalinks)\/([^/?#]+)/);
    if (postMatch && postMatch[1] && postMatch[1] !== "Uzpf") {
      postId = postMatch[1];
    }
  }

  // 3. Format as direct group feed post parameter: https://www.facebook.com/groups/{groupId}?post_id={postId}
  if (groupId && postId && !postId.startsWith("hash_")) {
    return `https://www.facebook.com/groups/${groupId}?post_id=${postId}`;
  }

  return targetUrl;
}
