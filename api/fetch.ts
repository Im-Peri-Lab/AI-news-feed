import {
  getTags,
  getKstDateStr,
  processArticle,
  fetchWithRetry,
  fetchNaverNews,
  processNaverItem,
  makeDeduper,
  isAiRelated,
  GOOGLE_QUERIES,
  NAVER_QUERIES,
  type NaverNewsItem,
} from '../lib/newsUtils.js';

interface FetchStats {
  googleRaw: number;
  googleAfterDateFilter: number;
  googleDroppedNonAi: number;
  naverRaw: number;
  naverDroppedNonAi: number;
  naverSkipped: boolean;
  finalTotal: number;
}

async function fetchAllNews(): Promise<{ articles: any[]; stats: FetchStats }> {
  const now = new Date();
  const dateStr = getKstDateStr(now);
  // This endpoint always collects "today", so when:1d (Google's trending pool)
  // gives the largest result set; publishedDate (KST) post-filter trims to today.
  const googleQueries = GOOGLE_QUERIES.map(q => `${q} when:1d`);

  const naverConfigured = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);

  const [tagSpecs, googleResults, naverResults] = await Promise.all([
    getTags(),
    Promise.allSettled(googleQueries.map(q => fetchWithRetry(q))),
    Promise.allSettled(NAVER_QUERIES.map(q => fetchNaverNews(q, dateStr))),
  ]);

  const addArticle = makeDeduper();
  const articles: any[] = [];

  const droppedSamples: string[] = [];

  let googleRaw = 0;
  let googleAfterDateFilter = 0;
  let googleDroppedNonAi = 0;
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
      if (!isAiRelated(article.title)) {
        googleDroppedNonAi++;
        if (droppedSamples.length < 5) droppedSamples.push(article.title);
        continue;
      }
      if (addArticle(article)) articles.push(article);
    }
  }

  let naverRaw = 0;
  let naverDroppedNonAi = 0;
  for (const result of naverResults) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item.link && !(item as NaverNewsItem).originallink) continue;
      naverRaw++;
      const article = processNaverItem(item as NaverNewsItem, tagSpecs);
      if (!isAiRelated(article.title)) {
        naverDroppedNonAi++;
        if (droppedSamples.length < 5) droppedSamples.push(article.title);
        continue;
      }
      if (addArticle(article)) articles.push(article);
    }
  }
  if (droppedSamples.length) {
    console.log('[fetch] droppedNonAi samples:', JSON.stringify(droppedSamples));
  }

  const stats: FetchStats = {
    googleRaw,
    googleAfterDateFilter,
    googleDroppedNonAi,
    naverRaw,
    naverDroppedNonAi,
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
