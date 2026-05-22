import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
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
} from './lib/newsUtils.js';

const app = express();

const GOOGLE_QUERIES = [
  '(AI OR 인공지능)',
  '(생성형 AI OR LLM OR AI 에이전트 OR AI 반도체)',
];

async function fetchNews(targetDate: string): Promise<any[]> {
  const afterDate = getKstOffsetDateStr(targetDate, -1);
  const beforeDate = getKstOffsetDateStr(targetDate, +1);
  const googleQueries = GOOGLE_QUERIES.map(q => `${q} after:${afterDate} before:${beforeDate}`);
  const isToday = targetDate === getKstDateStr(new Date());

  const [tagSpecs, googleResults, naverResults] = await Promise.all([
    getTags(),
    Promise.allSettled(googleQueries.map(q => fetchWithRetry(q))),
    isToday
      ? Promise.allSettled([
          fetchNaverNews('AI 인공지능', targetDate),
          fetchNaverNews('생성형AI LLM', targetDate),
        ])
      : Promise.resolve([]),
  ]);

  const addArticle = makeDeduper();
  const articles: any[] = [];

  for (const result of googleResults) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item.link) continue;
      const article = processArticle(item, tagSpecs);
      if (article.publishedDate !== targetDate) continue;
      if (addArticle(article)) articles.push(article);
    }
  }

  for (const result of naverResults) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item.link && !(item as NaverNewsItem).originallink) continue;
      const article = processNaverItem(item as NaverNewsItem, tagSpecs);
      if (addArticle(article)) articles.push(article);
    }
  }

  return articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/briefing', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const { articles, date } = req.body as { articles: { title: string; source: string }[]; date: string };
    if (!articles?.length) return res.status(400).json({ error: 'No articles provided' });

    const list = articles
      .slice(0, 50)
      .map((a, i) => `${i + 1}. ${a.title} (${a.source})`)
      .join('\n');

    const prompt = `다음은 ${date} AI 뉴스 기사 제목 목록입니다:\n\n${list}\n\n위 기사 제목만을 근거로 한국어 AI 뉴스 브리핑을 작성하세요. 아래 형식을 정확히 따르세요.\n\n## 핵심 요약\n오늘 AI 뉴스 전반을 2~3문장으로 요약.\n\n## 주요 흐름\n### 글로벌 빅테크\n- OpenAI, Google, MS, Meta, Anthropic, NVIDIA 등 글로벌 기업 관련 흐름 (1-2개, 각 1-2문장)\n\n### 국내 AX\n- 통신 3사(KT, SKT, LGU+), 삼성, 네이버, 카카오, SK 등 국내 기업 관련 흐름 (1-2개, 각 1-2문장)\n\n### 정책·사회\n- 정부 발표, 규제, 사회 논의 관련 흐름 (1-2개, 각 1-2문장)\n\n## 지켜볼 단서\n- 오늘 기사 제목에 명시적으로 언급된 일정·발표 예고만 작성\n\n## 놓치지 말 기사\n1. **기사 제목** — 출처\n2. **기사 제목** — 출처\n3. **기사 제목** — 출처\n\n매우 중요한 규칙(반드시 준수):\n1. 기사 제목에 없는 사실은 절대 추론·추가하지 마세요\n2. 회사명·제품명·날짜는 기사 제목에 명시된 것만 사용\n3. "지켜볼 단서"는 기사 제목에 명시적으로 언급된 일정·예고만 포함하고, 없으면 "오늘 기사에 명시된 일정 없음" 한 줄만 작성\n4. 각 카테고리에 해당 기사가 없으면 "해당 기사 없음" 한 줄만 작성\n5. 위 마크다운 헤더(##, ###) 형식을 반드시 유지하세요`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');

      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      for await (const chunk of stream) {
        if (chunk.text) res.write(chunk.text);
      }
      res.end();
    } catch (e: any) {
      console.error('[/api/briefing] error:', e);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to generate briefing' });
      else res.end();
    }
  });

  app.get('/api/news', async (req, res) => {
    try {
      const todayKst = getKstDateStr(new Date());
      const targetDate = typeof req.query.date === 'string' ? req.query.date : todayKst;
      const articles = await fetchNews(targetDate);
      res.json({ total: articles.length, articles });
    } catch (e: any) {
      console.error('[/api/news] error:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/fetch', async (req, res) => {
    try {
      const targetDate = getKstDateStr(new Date());
      const articles = await fetchNews(targetDate);
      res.json({ saved: articles.length, total: articles.length });
    } catch (e: any) {
      console.error('[/api/fetch] error:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  app.get('/r', (req, res) => {
    const target = typeof req.query.u === 'string' ? req.query.u : '';
    if (!target) return res.status(400).send('Missing redirect target');
    try {
      const parsed = new URL(target);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).send('Invalid protocol');
      }
      res.redirect(parsed.toString());
    } catch {
      res.status(400).send('Invalid redirect target');
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware loaded (Development)');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html from ${indexPath}:`, err);
          res.status(404).send('404: Page not found.');
        }
      });
    });
    console.log('Static serving initialized (Production)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

startServer();
