import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import express from 'express';
import path from 'path';
import Parser from 'rss-parser';
import crypto from 'crypto';
import { format } from 'date-fns';
import { GoogleGenAI } from '@google/genai';

const app = express();
const parser = new Parser();

// Core Tagging Logic (Shared or implemented here)
const TAGS = [
  { id: 'gen-ai', name: '생성형 AI', category: '기술', keywords: ['생성형 AI', 'generative AI', '생성형 인공지능'] },
  { id: 'llm', name: 'LLM', category: '기술', keywords: ['LLM', '대규모 언어모델', '언어모델', 'Large Language Model'] },
  { id: 'ai-agent', name: 'AI 에이전트', category: '기술', keywords: ['AI 에이전트', 'agent', '에이전틱', 'autonomous agent'] },
  { id: 'multimodal', name: '멀티모달 AI', category: '기술', keywords: ['멀티모달', '이미지 생성', '영상 생성', 'multimodal'] },
  { id: 'npu', name: 'AI 반도체', category: '기술', keywords: ['AI 반도체', 'GPU', 'NPU', 'HBM', '엔비디아 반도체'] },
  { id: 'ai-security', name: 'AI 보안', category: '기술', keywords: ['AI 보안', '보안 AI', '사이버 보안 AI', 'AI security'] },
  { id: 'gpt', name: 'GPT', category: '모델', keywords: ['GPT', 'ChatGPT', 'GPT-4', 'GPT-5'] },
  { id: 'claude', name: 'Claude', category: '모델', keywords: ['Claude', '클로드', 'Anthropic Claude'] },
  { id: 'gemini', name: 'Gemini', category: '모델', keywords: ['Gemini', '제미나이', 'Google Gemini'] },
  { id: 'exaone', name: 'Exaone', category: '모델', keywords: ['Exaone', 'EXAONE', '엑사원'] },
  { id: 'openai', name: 'OpenAI', category: '글로벌', keywords: ['OpenAI', '오픈에이아이', 'ChatGPT'] },
  { id: 'google', name: 'Google', category: '글로벌', keywords: ['Google', '구글', 'DeepMind', 'Gemini'] },
  { id: 'ms', name: 'Microsoft', category: '글로벌', keywords: ['Microsoft', '마이크로소프트', 'Copilot', 'Azure AI'] },
  { id: 'nvidia', name: 'NVIDIA', category: '글로벌', keywords: ['NVIDIA', '엔비디아'] },
  { id: 'amazon', name: 'Amazon', category: '글로벌', keywords: ['Amazon', '아마존', 'AWS', 'Bedrock'] },
  { id: 'meta', name: 'Meta', category: '글로벌', keywords: ['Meta', '메타', 'Llama'] },
  { id: 'anthropic', name: 'Anthropic', category: '글로벌', keywords: ['Anthropic', '앤스로픽', 'Claude'] },
  { id: 'naver-ai', name: '네이버 AI', category: '국내', keywords: ['네이버 AI', '하이퍼클로바', 'HyperCLOVA', '네이버클라우드'] },
  { id: 'sk-ai', name: 'SK AI', category: '국내', keywords: ['SK AI', 'SK텔레콤 AI', '에이닷', 'A.', 'SKT AI'] },
  { id: 'kt-ai', name: 'KT AI', category: '국내', keywords: ['KT AI', 'KT 인공지능', '믿음', 'Mi:dm'] },
  { id: 'lg-ai', name: 'LG AI', category: '국내', keywords: ['LG AI', 'LG AI연구원', '엑사원', 'EXAONE'] },
  { id: 'samsung-ai', name: '삼성 AI', category: '국내', keywords: ['삼성 AI', 'Samsung AI', '갤럭시 AI', '가우스'] },
  { id: 'kakao-ai', name: '카카오 AI', category: '국내', keywords: ['카카오 AI', 'Kakao AI', '카나나'] },
  { id: 'saltlux', name: '솔트룩스', category: '국내', keywords: ['솔트룩스', 'Saltlux'] },
  { id: 'wrtn', name: '뤼튼', category: '국내', keywords: ['뤼튼', 'Wrtn', '뤼튼테크놀로지스'] },
  { id: 'upstage', name: '업스테이지', category: '국내', keywords: ['업스테이지', 'Upstage', 'Solar'] },
];

const SEARCH_QUERIES = [
  '(AI OR 인공지능 OR "생성형 AI") when:24h',
  '(LLM OR "AI 에이전트" OR "AI 반도체" OR AX) when:24h'
];

// In-memory store (PRD suggests Sheets, but for this environment we use a variable)
let articleStore: any[] = [];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

function generateId(url: string) {
  return crypto.createHash('md5').update(url).digest('hex');
}

function processArticle(item: any) {
  let title = item.title || '';
  let source = item.creator || item.author || 'AI News';
  
  // Google News RSS titles usually end with " - Source Name"
  const sourceMatch = title.match(/(.*) - (.*)$/);
  if (sourceMatch) {
    title = sourceMatch[1].trim();
    source = sourceMatch[2].trim();
  }

  const url = item.link || '';
  const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
  const safePubDate = Number.isNaN(pubDate.getTime()) ? new Date() : pubDate;
  const isoDate = safePubDate.toISOString();
  const dateString = format(safePubDate, 'yyyy-MM-dd');

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
    source,
    publishedAt: isoDate,
    publishedDate: dateString,
    tags,
    categories,
    matchedTerms,
    collector: 'google_news_rss',
    fetchedAt: new Date().toISOString()
  };
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(query: string, retries = 3, backoff = 5000) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 503 || response.status === 429) {
          throw new Error(`Status ${response.status}`);
        }
        console.error(`Fetch error for ${query}: ${response.status} ${response.statusText}`);
        return [];
      }

      const xml = await response.text();
      const feed = await parser.parseString(xml);
      return feed.items;
    } catch (e: any) {
      const isRetryable = e.message && (e.message.includes('503') || e.message.includes('429'));
      if (isRetryable && i < retries - 1) {
        const jitter = Math.floor(Math.random() * 3000); // More jitter
        const waitTime = backoff + jitter;
        console.warn(`Fetch error for ${query} (Attempt ${i + 1}/${retries}). Retrying in ${waitTime}ms...`);
        await delay(waitTime);
        backoff *= 2; 
        continue;
      }
      console.error(`Final fetch error for ${query}:`, e.message || e);
      return [];
    }
  }
  return [];
}

async function fetchNews() {
  const allResults: any[] = [];
  const seenUrls = new Set<string>();

  console.log('Starting news update...');

  // Use sequential fetching with MUCH longer delays to stay under the radar
  for (const query of SEARCH_QUERIES) {
    const items = await fetchWithRetry(query);
    if (items && items.length > 0) {
      items.forEach(item => {
        if (!item.link || seenUrls.has(item.link)) return;
        seenUrls.add(item.link);
        allResults.push(processArticle(item));
      });
    }
    // Very long delay between queries (10-15 seconds)
    if (SEARCH_QUERIES.indexOf(query) < SEARCH_QUERIES.length - 1) {
      const wait = 10000 + Math.random() * 5000;
      console.log(`Waiting ${Math.round(wait/1000)}s before next query...`);
      await delay(wait);
    }
  }

  // Unique by URL/ID
  const uniqueResults = allResults.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
  
  // Merge with store
  const existingIds = new Set(articleStore.map(a => a.id));
  const newArticles = uniqueResults.filter(a => !existingIds.has(a.id));
  
  articleStore = [...newArticles, ...articleStore].slice(0, 1000); // Keep last 1000
  console.log(`News updated. New: ${newArticles.length}, Total: ${articleStore.length}`);
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

  app.get('/api/news', (req, res) => {
    const { date } = req.query;
    let filtered = [...articleStore];
    if (date) {
      filtered = articleStore.filter(a => a.publishedDate === date);
    }
    // Sort by latest
    filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    res.json({ total: filtered.length, articles: filtered });
  });

  app.post('/api/fetch', async (req, res) => {
    const beforeCount = articleStore.length;
    await fetchNews();
    const afterCount = articleStore.length;
    res.json({ saved: afterCount - beforeCount, total: afterCount });
  });

  app.get('/api/tags', (req, res) => {
    res.json({ tags: TAGS });
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

  app.get('/debug-root', (req, res) => {
    res.send(`Server is alive. ENV: ${process.env.NODE_ENV}. Time: ${new Date().toISOString()}`);
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
    console.log(`Serving production build from: ${distPath}`);
    
    // Serve static files
    app.use(express.static(distPath));
    
    // Fallback for SPA
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html from ${indexPath}:`, err);
          res.status(404).send(`404: Page not found. The server could not find index.html at ${indexPath}. Please ensure 'npm run build' was executed.`);
        }
      });
    });
    console.log('Static serving initialized (Production)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    // Background fetch after start
    fetchNews().catch(console.error);
  });
}

startServer();
