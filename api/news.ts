import Parser from 'rss-parser';
import crypto from 'crypto';
import { get } from '@vercel/edge-config';
import { DEFAULT_TAGS, type TagSpec } from '../lib/apiConstants';

async function getTagsFromConfig(): Promise<TagSpec[]> {
  try {
    return (await get<TagSpec[]>('tags')) ?? DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
}

const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
    ],
  },
});

const BASE_QUERIES = [
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

function daysAgoFromToday(targetDate: string, todayKst: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const t = new Date(targetDate + 'T00:00:00+09:00').getTime();
  const n = new Date(todayKst + 'T00:00:00+09:00').getTime();
  return Math.max(0, Math.round((n - t) / msPerDay));
}

function generateId(url: string) {
  return crypto.createHash('md5').update(url).digest('hex');
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
    const isMatched = tag.keywords.some(keyword =>
      title.toLowerCase().includes(keyword.toLowerCase())
    );
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

async function fetchAllNews(queries: string[], tags: TagSpec[]): Promise<any[]> {
  const results = await Promise.allSettled(queries.map(q => fetchWithRetry(q)));

  const seenIds = new Set<string>();
  const articles: any[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item.link) continue;
      const article = processArticle(item, tags);
      if (!seenIds.has(article.id)) {
        seenIds.add(article.id);
        articles.push(article);
      }
    }
  }

  return articles;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const todayKst = getKstDateStr(new Date());
    const targetDate = typeof req.query.date === 'string' ? req.query.date : todayKst;

    const daysAgo = daysAgoFromToday(targetDate, todayKst);

    // Google News RSS only reliably supports when:1d and when:7d.
    // Intermediate values like when:2d over-include the previous day, shrinking
    // today's result set (see commit 963b49a). The publishedDate===targetDate
    // filter below narrows when:7d to the requested past date.
    const dateParam = daysAgo === 0 ? 'when:1d' : 'when:7d';

    const queries = BASE_QUERIES.map(q => `${q} ${dateParam}`);

    let tags: TagSpec[];
    try {
      tags = await getTagsFromConfig();
    } catch (e) {
      console.error('[api/news] Edge Config tag load failed, using defaults:', e);
      tags = DEFAULT_TAGS;
    }

    const articles = await fetchAllNews(queries, tags);

    const filtered = articles
      .filter(a => a.publishedDate === targetDate)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Debug: log articles excluded by the date filter so timezone issues are visible
    const excluded = articles.filter(a => a.publishedDate !== targetDate);
    if (excluded.length > 0) {
      console.log(
        `[api/news] date-filter excluded ${excluded.length} articles` +
        ` (targetDate=${targetDate}, totalFetched=${articles.length}, shown=${filtered.length})`
      );
      excluded.slice(0, 10).forEach(a =>
        console.log(
          `[api/news]   EXCLUDED publishedDate=${a.publishedDate}` +
          ` pubISO=${a.publishedAt} title="${a.title.slice(0, 60)}"`
        )
      );
    }

    const dateSample = [...new Set(articles.map(a => a.publishedDate))].sort();
    const excludedDates = Object.fromEntries(
      dateSample
        .filter(d => d !== targetDate)
        .map(d => [d, articles.filter(a => a.publishedDate === d).length])
    );

    res.json({
      total: filtered.length,
      articles: filtered,
      _debug: {
        todayKst,
        targetDate,
        daysAgo,
        dateParam,
        totalFetched: articles.length,
        shown: filtered.length,
        excludedByDateFilter: excluded.length,
        excludedDates,
        datesInRss: dateSample,
      },
    });
  } catch (e: any) {
    console.error('GET /api/news error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
}
