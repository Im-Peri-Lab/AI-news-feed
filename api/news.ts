import {
  getKstDateStr,
  getKstOffsetDateStr,
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
// Read tags via the connection string (no VERCEL_API_TOKEN needed). This is a
// read-only path, so the CDN cache lag that getTagsCached carries is acceptable.
import { getTagsCached } from '../lib/edgeConfig.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const todayKst = getKstDateStr(new Date());
    const targetDate = typeof req.query.date === 'string' ? req.query.date : todayKst;
    const isToday = targetDate === todayKst;

    // Today uses when:1d (Google's trending pool is large and well-stocked).
    // Past dates use absolute after/before — when:1d/7d can't target a specific
    // past day, and when:7d dilutes a single day across the ~100-item cap.
    // after/before are UTC boundaries, so widen by ±1 day; publishedDate (KST)
    // post-filter below trims back to the exact target date.
    const googleDateSuffix = isToday
      ? 'when:1d'
      : `after:${getKstOffsetDateStr(targetDate, -1)} before:${getKstOffsetDateStr(targetDate, +1)}`;
    const googleQueries = GOOGLE_QUERIES.map(q => `${q} ${googleDateSuffix}`);

    const tags = await getTagsCached();

    const [googleResults, naverResults] = await Promise.all([
      Promise.allSettled(googleQueries.map(q => fetchWithRetry(q))),
      // Naver sort=date only returns recent 100 items — only useful for today
      isToday
        ? Promise.allSettled(NAVER_QUERIES.map(q => fetchNaverNews(q, targetDate)))
        : Promise.resolve([]),
    ]);

    const addArticle = makeDeduper();
    const all: any[] = [];

    const droppedSamples: string[] = [];
    let droppedGoogle = 0;
    let droppedNaver = 0;

    const googleRaw = googleResults.map(r => r.status === 'fulfilled' ? r.value.length : 0);
    for (const result of googleResults) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        if (!item.link) continue;
        const article = processArticle(item, tags);
        if (!isAiRelated(article.title)) {
          droppedGoogle++;
          if (droppedSamples.length < 5) droppedSamples.push(article.title);
          continue;
        }
        if (addArticle(article)) all.push(article);
      }
    }
    const googleAfterDedup = all.length;

    const naverRaw = naverResults.map((r: any) => r.status === 'fulfilled' ? r.value.length : 0);
    for (const result of naverResults) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        if (!item.link && !(item as NaverNewsItem).originallink) continue;
        const article = processNaverItem(item as NaverNewsItem, tags);
        if (!isAiRelated(article.title)) {
          droppedNaver++;
          if (droppedSamples.length < 5) droppedSamples.push(article.title);
          continue;
        }
        if (addArticle(article)) all.push(article);
      }
    }
    if (droppedSamples.length) {
      console.log('[news] droppedNonAi samples:', JSON.stringify(droppedSamples));
    }

    const beforeDedup = googleRaw.reduce((a: number, b: number) => a + b, 0)
      + naverRaw.reduce((a: number, b: number) => a + b, 0);

    const filtered = all
      .filter(a => a.publishedDate === targetDate)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const googleAfterDateFilter = all.filter(a => a.collector === 'google_news_rss' && a.publishedDate === targetDate).length;
    const naverAfterDateFilter = all.filter(a => a.collector === 'naver_news_api' && a.publishedDate === targetDate).length;

    res.json({
      total: filtered.length,
      articles: filtered,
      stats: {
        google: {
          dateMode: isToday ? 'when:1d' : 'after/before',
          queriesRaw: googleRaw,
          totalRaw: googleRaw.reduce((a, b) => a + b, 0),
          afterDateFilter: googleAfterDateFilter,
          droppedNonAi: droppedGoogle,
        },
        naver: {
          queriesRaw: naverRaw,
          totalRaw: naverRaw.reduce((a: number, b: number) => a + b, 0),
          afterDateFilter: naverAfterDateFilter,
          droppedNonAi: droppedNaver,
        },
        beforeDedup,
        afterGoogleDedup: googleAfterDedup,
        finalTotal: filtered.length,
      },
    });
  } catch (e: any) {
    console.error('GET /api/news error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
}
