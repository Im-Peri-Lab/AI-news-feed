import Parser from 'rss-parser';
import crypto from 'crypto';
import { type TagSpec } from '../lib/apiConstants.js';

function getEdgeConfigId(): string {
  const match = (process.env.EDGE_CONFIG || '').match(/ecfg_[a-zA-Z0-9]+/);
  return match ? match[0] : '';
}

async function getTagsFromConfig(): Promise<TagSpec[]> {
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

const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
    ],
  },
});

// Google RSS after/before are interpreted as UTC boundaries, so KST 00:00–08:59
// would fall outside after:dateStr. Widen the window by one day on each side and
// filter to KST dateStr after parsing.
const BASE_QUERIES_TODAY = [
  '(AI OR 인공지능)',
  '(생성형 AI OR LLM OR AI 에이전트 OR AI 반도체)',
];

const BASE_QUERIES_PAST = [
  '(AI OR 인공지능 OR "생성형 AI")',
  '(LLM OR "AI 에이전트" OR "AI 반도체" OR AX)',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

function getKstDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getKstOffsetDateStr(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return next.toISOString().slice(0, 10);
}

function daysAgoFromToday(targetDate: string, todayKst: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const t = new Date(targetDate + 'T00:00:00+09:00').getTime();
  const n = new Date(todayKst + 'T00:00:00+09:00').getTime();
  return Math.max(0, Math.round((n - t) / msPerDay));
}

function generateId(url: string) {
  return crypto.createHash('md5').update(url).digest('hex');
}

function isExactMatch(title: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![a-zA-Z0-9가-힣])${escaped}(?![a-zA-Z0-9가-힣])`, 'i');
  return regex.test(title);
}

function normalizeTitle(title: string): string {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/[^가-힣a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 30);
}

function processArticle(item: any, TAGS: TagSpec[]) {
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
  const publishedDate = getKstDateStr(safePubDate);

  const tags: string[] = [];
  const categories: string[] = [];
  const matchedTerms: string[] = [];

  TAGS.forEach(tag => {
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
    publishedDate,
    tags,
    categories,
    matchedTerms,
    collector: 'google_news_rss',
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchWithRetry(query: string, retries = 2, backoff = 2000): Promise<any[]> {
  // Add timestamp to bypass Google's server-side cache and get fresh results each request
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

// Naver News API

interface NaverNewsItem {
  title: string;
  link: string;
  originallink: string;
  pubDate: string;
}

interface NaverNewsResponse {
  items: NaverNewsItem[];
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

async function fetchNaverNews(query: string, targetDateStr: string): Promise<NaverNewsItem[]> {
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
      return !Number.isNaN(pubDate.getTime()) && getKstDateStr(pubDate) === targetDateStr;
    });
  } catch (e: any) {
    console.error(`Naver fetch error for "${query}":`, e.message || e);
    return [];
  }
}

function processNaverItem(item: NaverNewsItem, tagSpecs: TagSpec[]) {
  const rawTitle = item.title.replace(/<[^>]+>/g, '').trim();
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const todayKst = getKstDateStr(new Date());
    const targetDate = typeof req.query.date === 'string' ? req.query.date : todayKst;
    const daysAgo = daysAgoFromToday(targetDate, todayKst);
    const isToday = daysAgo === 0;

    // Build Google queries
    let googleQueries: string[];
    if (isToday) {
      const prevDate = getKstOffsetDateStr(targetDate, -1);
      const nextDate = getKstOffsetDateStr(targetDate, +2);
      googleQueries = BASE_QUERIES_TODAY.map(q => `${q} after:${prevDate} before:${nextDate}`);
    } else {
      // Google News RSS only reliably supports when:1d and when:7d for past dates.
      const dateParam = 'when:7d';
      googleQueries = BASE_QUERIES_PAST.map(q => `${q} ${dateParam}`);
    }

    const tags = await getTagsFromConfig();

    const [googleResults, naverResults] = await Promise.all([
      Promise.allSettled(googleQueries.map(q => fetchWithRetry(q))),
      // Naver sort=date only returns recent 100 items — only useful for today
      isToday
        ? Promise.allSettled([
            fetchNaverNews('AI 인공지능', targetDate),
            fetchNaverNews('생성형AI LLM', targetDate),
          ])
        : Promise.resolve([]),
    ]);

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const all: any[] = [];

    function addArticle(article: ReturnType<typeof processArticle>) {
      const titleKey = normalizeTitle(article.title);
      if (seenIds.has(article.id) || seenTitles.has(titleKey)) return;
      seenIds.add(article.id);
      seenTitles.add(titleKey);
      all.push(article);
    }

    for (const result of googleResults) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        if (!item.link) continue;
        addArticle(processArticle(item, tags));
      }
    }

    for (const result of naverResults) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        if (!item.link && !(item as NaverNewsItem).originallink) continue;
        addArticle(processNaverItem(item as NaverNewsItem, tags));
      }
    }

    const filtered = all
      .filter(a => a.publishedDate === targetDate)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    res.json({
      total: filtered.length,
      articles: filtered,
    });
  } catch (e: any) {
    console.error('GET /api/news error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
}
