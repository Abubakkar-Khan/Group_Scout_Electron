export interface KeywordLike {
  keyword: string;
}

export interface KeywordMatch {
  keyword: string;
  score: number;
}

const MIN_TOKEN_LENGTH = 2;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "from",
  "i",
  "in",
  "is",
  "me",
  "my",
  "need",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export function normalizeLeadText(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9#+.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordTokens(keyword: string): string[] {
  return normalizeLeadText(keyword)
    .split(" ")
    .filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(token));
}

export function findBestKeywordMatch(
  content: string,
  keywords: KeywordLike[],
  negativeKeywords: KeywordLike[] = []
): KeywordMatch | null {
  const normalizedContent = ` ${normalizeLeadText(content)} `;

  // 1. Exclude if post matches any negative keyword
  for (const item of negativeKeywords) {
    const negKeyword = item.keyword.trim();
    if (!negKeyword) continue;

    const normalizedNeg = normalizeLeadText(negKeyword);
    if (normalizedContent.includes(` ${normalizedNeg} `)) {
      return null; // Excluded by negative keyword match
    }
  }

  // 2. Match target positive keywords
  let best: KeywordMatch | null = null;

  for (const item of keywords) {
    const keyword = item.keyword.trim();
    if (!keyword) continue;

    const normalizedKeyword = normalizeLeadText(keyword);
    const phraseMatched = normalizedContent.includes(` ${normalizedKeyword} `);
    const tokens = keywordTokens(keyword);
    const matchedTokens = tokens.filter((token) => normalizedContent.includes(` ${token} `));

    if (!phraseMatched && (tokens.length === 0 || matchedTokens.length < tokens.length)) {
      continue;
    }

    const score = (phraseMatched ? 100 : 0) + matchedTokens.length;
    if (!best || score > best.score) {
      best = { keyword, score };
    }
  }

  return best;
}
