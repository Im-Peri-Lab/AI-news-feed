import Parser from 'rss-parser';
import crypto from 'crypto';
import { type TagSpec } from './apiConstants.js';

// ── Edge Config ──────────────────────────────────────────────────────────────

export function getEdgeConfigId(): string {
  const match = (process.env.EDGE_CONFIG || '').match(/ecfg_[a-zA-Z0-9]+/);
  return match ? match[0] : '';
}

export async function getTags(): Promise<TagSpec[]> {
  const edgeConfigId = getEdgeConfigId();
  const token = process.env.VERCEL_API_TOKEN;
  if (!edgeConfigId || !token) throw new Error('Edge Config not configured');
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/tags`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Edge Config read failed: ${res.status}`);
  const data = await res.json();
  const tags = data?.value as TagSpec[] | null;
  if (!tags) throw new Error('No tags found in Edge Config');
  return tags;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

export function getKstDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getKstOffsetDateStr(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return next.toISOString().slice(0, 10);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function generateId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

export function isExactMatch(title: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![a-zA-Z0-9가-힣])${escaped}(?![a-zA-Z0-9가-힣])`, 'i');
  return regex.test(title);
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export function normalizeTitle(title: string): string {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/[^가-힣a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 30);
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ── Article processing ────────────────────────────────────────────────────────

export function processArticle(item: any, tagSpecs: TagSpec[]) {
  let title = item.title || '';
  let source = item.creator || item.author || 'AI News';

  const lastDash = title.lastIndexOf(' - ');
  if (lastDash !== -1) {
    const extracted = title.substring(lastDash + 3).trim();
    if (extracted.length > 0 && extracted.length < 50) {
      title = title.substring(0, lastDash).trim();
      source = extracted;
    }
  }

  const url = item.link || '';
  const imageUrl: string =
    item.mediaThumbnail?.$.url ||
    item.mediaContent?.$.url ||
    item.enclosure?.url ||
    '';
  const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
  const safePubDate = Number.isNaN(pubDate.getTime()) ? new Date() : pubDate;

  const tags: string[] = [];
  const categories: string[] = [];
  const matchedTerms: string[] = [];

  tagSpecs.forEach(tag => {
    const hasExactMatch = tag.keywords.some(kw => isExactMatch(title, kw));
    const hasPartialMatch = !hasExactMatch && tag.keywords.some(kw => title.toLowerCase().includes(kw.toLowerCase()));
    const isExcluded = (tag.excludeKeywords ?? []).some(kw => title.toLowerCase().includes(kw.toLowerCase()));
    const isMatched = hasExactMatch || (hasPartialMatch && !isExcluded);
    if (isMatched) {
      if (!tags.includes(tag.name)) tags.push(tag.name);
      if (!categories.includes(tag.category)) categories.push(tag.category);
      matchedTerms.push(tag.name);
    }
  });

  return {
    id: generateId(url),
    title,
    url,
    imageUrl,
    source,
    publishedAt: safePubDate.toISOString(),
    publishedDate: getKstDateStr(safePubDate),
    tags,
    categories,
    matchedTerms,
    collector: 'google_news_rss',
    fetchedAt: new Date().toISOString(),
  };
}

// ── Google News RSS ───────────────────────────────────────────────────────────

const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
    ],
  },
});

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

export async function fetchWithRetry(query: string, retries = 2, backoff = 2000): Promise<any[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko&_t=${Date.now()}`;

  for (let i = 0; i < retries; i++) {
    try {
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        if ((response.status === 503 || response.status === 429) && i < retries - 1) {
          await new Promise(r => setTimeout(r, backoff * (i + 1)));
          continue;
        }
        return [];
      }

      const xml = await response.text();
      const feed = await parser.parseString(xml);
      return feed.items;
    } catch (e: any) {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, backoff * (i + 1)));
        continue;
      }
      console.error(`Fetch error for "${query}":`, e.message || e);
      return [];
    }
  }
  return [];
}

// ── Naver News API ────────────────────────────────────────────────────────────

export const NAVER_QUERIES = [
  'AI OR 인공지능',
  '생성형AI OR LLM OR AI 에이전트 OR AI 반도체 OR AI 스타트업 OR 데이터센터 OR 피지컬 AI OR AI 보안 OR AI 허브',
];

const NAVER_TITLE_KEYWORDS = [
  'AI', '인공지능', 'LLM', 'GPT', '생성형', '에이전틱', '에이전트',
  '딥러닝', '머신러닝', 'AX', '엔비디아', '딥테크', '구글', '앤트로픽',
  '오픈AI', '마이크로소프트', 'MS', 'AWS', '클로드', 'claude', '제미나이',
  'gemini', '엑사원', 'exaone', '반도체',
];

export function isNaverTitleRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  return NAVER_TITLE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

export interface NaverNewsItem {
  title: string;
  link: string;
  originallink: string;
  pubDate: string;
}

export interface NaverNewsResponse {
  items: NaverNewsItem[];
}

export async function fetchNaverNews(query: string, targetDateStr: string): Promise<NaverNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const params = new URLSearchParams({ query, display: '100', sort: 'date' });
  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news.json?${params}`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );
    if (!response.ok) {
      console.error(`Naver API error: ${response.status}`);
      return [];
    }
    const data = await response.json() as NaverNewsResponse;
    return (data.items ?? []).filter(item => {
      const pubDate = new Date(item.pubDate);
      if (Number.isNaN(pubDate.getTime()) || getKstDateStr(pubDate) !== targetDateStr) return false;
      const title = decodeHtmlEntities(item.title.replace(/<[^>]+>/g, '').trim());
      return isNaverTitleRelevant(title);
    });
  } catch (e: any) {
    console.error(`Naver fetch error for "${query}":`, e.message || e);
    return [];
  }
}

export function processNaverItem(item: NaverNewsItem, tagSpecs: TagSpec[]) {
  const rawTitle = decodeHtmlEntities(item.title.replace(/<[^>]+>/g, '').trim());
  const url = item.link || item.originallink || '';
  const source = extractDomain(item.originallink || item.link || '');
  const pubDate = new Date(item.pubDate);
  const safePubDate = Number.isNaN(pubDate.getTime()) ? new Date() : pubDate;

  const tags: string[] = [];
  const categories: string[] = [];
  const matchedTerms: string[] = [];

  tagSpecs.forEach(tag => {
    const hasExactMatch = tag.keywords.some(kw => isExactMatch(rawTitle, kw));
    const hasPartialMatch = !hasExactMatch && tag.keywords.some(kw => rawTitle.toLowerCase().includes(kw.toLowerCase()));
    const isExcluded = (tag.excludeKeywords ?? []).some(kw => rawTitle.toLowerCase().includes(kw.toLowerCase()));
    const isMatched = hasExactMatch || (hasPartialMatch && !isExcluded);
    if (isMatched) {
      if (!tags.includes(tag.name)) tags.push(tag.name);
      if (!categories.includes(tag.category)) categories.push(tag.category);
      matchedTerms.push(tag.name);
    }
  });

  return {
    id: generateId(url),
    title: rawTitle,
    url,
    imageUrl: '',
    source,
    publishedAt: safePubDate.toISOString(),
    publishedDate: getKstDateStr(safePubDate),
    tags,
    categories,
    matchedTerms,
    collector: 'naver_news_api',
    fetchedAt: new Date().toISOString(),
  };
}

// ── Dedup helper ──────────────────────────────────────────────────────────────

export function makeDeduper() {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  return function add(article: { id: string; title: string }): boolean {
    const titleKey = normalizeTitle(article.title);
    if (seenIds.has(article.id) || seenTitles.has(titleKey)) return false;
    seenIds.add(article.id);
    seenTitles.add(titleKey);
    return true;
  };
}
