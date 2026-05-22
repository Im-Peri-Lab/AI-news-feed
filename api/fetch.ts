import {
  getTags,
  getKstDateStr,
  getKstOffsetDateStr,
  processArticle,
  fetchWithRetry,
  fetchNaverNews,
  processNaverItem,
  makeDeduper,
  type NaverNewsItem,
} from '../lib/newsUtils.js';

function buildSearchQueries(dateStr: string): string[] {
  // Google RSS after/before are interpreted as UTC boundaries, so KST 00:00–08:59
  // would fall outside after:dateStr. Widen the window by one day on each side and
  // filter to KST dateStr after parsing.
  const prevDateStr = getKstOffsetDateStr(dateStr, -1);
  const nextDateStr = getKstOffsetDateStr(dateStr, +2);
  return [
    `(AI OR 인공지능) after:${prevDateStr} before:${nextDateStr}`,
    `(생성형 AI OR LLM OR AI 에이전트 OR AI 반도체) after:${prevDateStr} before:${nextDateStr}`,
  ];
}

interface FetchStats {
  googleRaw: number;
  googleAfterDateFilter: number;
  naverRaw: number;
  naverSkipped: boolean;
  finalTotal: number;
}

async function fetchAllNews(): Promise<{ articles: any[]; stats: FetchStats }> {
  const now = new Date();
  const dateStr = getKstDateStr(now);
  const searchQueries = buildSearchQueries(dateStr);

  const naverConfigured = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);

  const [tagSpecs, googleResults, naverResults] = await Promise.all([
    getTags(),
    Promise.allSettled(searchQueries.map(q => fetchWithRetry(q))),
    Promise.allSettled([
      fetchNaverNews('AI 인공지능', dateStr),
      fetchNaverNews('생성형AI LLM', dateStr),
    ]),
  ]);

  const addArticle = makeDeduper();
  const articles: any[] = [];

  let googleRaw = 0;
  let googleAfterDateFilter = 0;
  for (const result of googleResults) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item.link) continue;
      googleRaw++;
      const article = processArticle(item, tagSpecs);
      // Post-filter to KST dateStr: the RSS window is widened by ±1 day to cover
      // the UTC/KST boundary gap, so trim back to the target date here.
      if (article.publishedDate !== dateStr) continue;
      googleAfterDateFilter++;
      if (addArticle(article)) articles.push(article);
    }
  }

  let naverRaw = 0;
  for (const result of naverResults) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item.link && !(item as NaverNewsItem).originallink) continue;
      naverRaw++;
      const article = processNaverItem(item as NaverNewsItem, tagSpecs);
      if (addArticle(article)) articles.push(article);
    }
  }

  const stats: FetchStats = {
    googleRaw,
    googleAfterDateFilter,
    naverRaw,
    naverSkipped: !naverConfigured,
    finalTotal: articles.length,
  };
  console.log('[fetch] stats:', JSON.stringify(stats));

  return { articles, stats };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { articles, stats } = await fetchAllNews();
    res.json({ saved: articles.length, total: articles.length, stats });
  } catch (e: any) {
    console.error('POST /api/fetch error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
}
