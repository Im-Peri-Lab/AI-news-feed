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

const BASE_QUERIES = [
  '(AI OR 인공지능)',
  '(생성형 AI OR LLM OR AI 에이전트 OR AI 반도체)',
];

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const todayKst = getKstDateStr(new Date());
    const targetDate = typeof req.query.date === 'string' ? req.query.date : todayKst;
    const isToday = targetDate === todayKst;

    // Google RSS after/before are UTC boundaries. KST 00:00–08:59 = UTC previous
    // day, so always widen after by -1 day and post-filter by publishedDate (KST).
    const afterDate = getKstOffsetDateStr(targetDate, -1);
    const beforeDate = getKstOffsetDateStr(targetDate, +1);
    const googleQueries = BASE_QUERIES.map(q => `${q} after:${afterDate} before:${beforeDate}`);

    const tags = await getTags();

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

    const addArticle = makeDeduper();
    const all: any[] = [];

    const googleRaw = googleResults.map(r => r.status === 'fulfilled' ? r.value.length : 0);
    for (const result of googleResults) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        if (!item.link) continue;
        const article = processArticle(item, tags);
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
        if (addArticle(article)) all.push(article);
      }
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
          query1Raw: googleRaw[0] ?? 0,
          query2Raw: googleRaw[1] ?? 0,
          afterDateFilter: googleAfterDateFilter,
        },
        naver: {
          query1Raw: naverRaw[0] ?? 0,
          query2Raw: naverRaw[1] ?? 0,
          afterDateFilter: naverAfterDateFilter,
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
