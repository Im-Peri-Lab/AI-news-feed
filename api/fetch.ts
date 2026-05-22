import Parser from 'rss-parser';
import crypto from 'crypto';
import { type TagSpec } from '../lib/apiConstants.js';

function getEdgeConfigId(): string {
  const match = (process.env.EDGE_CONFIG || '').match(/ecfg_[a-zA-Z0-9]+/);
  return match ? match[0] : '';
}

async function getTags(): Promise<TagSpec[]> {
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

const SEARCH_QUERIES = [
  '(AI OR 인공지능 OR "생성형 AI") when:7d',
  '(LLM OR "AI 에이전트" OR "AI 반도체" OR AX) when:7d',
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

function generateId(url: string) {
  return crypto.createHash('md5').update(url).digest('hex');
}

function isExactMatch(title: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![a-zA-Z0-9가-힣])${escaped}(?![a-zA-Z0-9가-힣])`, 'i');
  return regex.test(title);
}

function processArticle(item: any, tagSpecs: TagSpec[]) {
  let title = item.title || '';
  let source = item.creator || item.author || 'AI News';

  const sourceMatch = title.match(/(.*) - (.*)$/);
  if (sourceMatch) {
    title = sourceMatch[1].trim();
    source = sourceMatch[2].trim();
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

async function fetchAllNews(): Promise<any[]> {
  const [tagSpecs, results] = await Promise.all([
    getTags(),
    Promise.allSettled(SEARCH_QUERIES.map(q => fetchWithRetry(q))),
  ]);

  const seenIds = new Set<string>();
  const articles: any[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item.link) continue;
      const article = processArticle(item, tagSpecs);
      if (!seenIds.has(article.id)) {
        seenIds.add(article.id);
        articles.push(article);
      }
    }
  }

  return articles;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const articles = await fetchAllNews();
    res.json({ saved: articles.length, total: articles.length });
  } catch (e: any) {
    console.error('POST /api/fetch error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
}
