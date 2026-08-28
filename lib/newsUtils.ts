import Parser from 'rss-parser';
import crypto from 'crypto';
import { type TagSpec } from './apiConstants.js';

// Edge Config access lives in lib/edgeConfig.ts; re-exported here so existing
// importers (api/news, api/fetch) keep working without churn.
export { getEdgeConfigId, getTags } from './edgeConfig.js';

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

const HANGUL = /[가-힣]/;
const ALNUM = /[a-zA-Z0-9]/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 경계는 키워드와 같은 문자 체계에서만 따진다. 한국어는 교착어라 키워드 뒤에
// 조사와 복합어가 그대로 붙으므로('KT가', '구글과', '삼성전자'), 뒤 경계를
// 한글까지 막으면 정상 매칭이 대량으로 깨진다.
function boundary(ch: string, side: 'before' | 'after'): string {
  const cls = HANGUL.test(ch) ? '가-힣' : ALNUM.test(ch) ? 'a-zA-Z0-9' : '';
  if (!cls) return '';
  return side === 'before' ? `(?<![${cls}])` : `(?![${cls}])`;
}

export function isExactMatch(title: string, keyword: string): boolean {
  if (!keyword) return false;
  const regex = new RegExp(
    `${boundary(keyword[0], 'before')}${escapeRe(keyword)}${boundary(keyword[keyword.length - 1], 'after')}`,
    'i'
  );
  return regex.test(title);
}

// 부분 매칭. 영문·숫자로 시작하는 키워드에만 앞 경계를 요구한다. 영문 약어는
// 앞에 글자가 붙으면 다른 뜻이 되지만('SKT'는 KT가 아니고 'TASK'는 SK가 아니다),
// 한글은 앞에 붙어도 뜻이 이어지는 복합어가 많아('신한투자증권'의 증권,
// '시스템반도체'의 반도체) 앞 경계를 요구하면 정상 매칭을 잃는다.
export function isPartialMatch(title: string, keyword: string): boolean {
  if (!keyword) return false;
  const escaped = escapeRe(keyword);
  if (!ALNUM.test(keyword[0])) return title.toLowerCase().includes(keyword.toLowerCase());
  if (new RegExp(`(?<![a-zA-Z0-9])${escaped}`, 'i').test(title)) return true;
  // camelCase 예외: 소문자 뒤의 대문자 약어는 새 단어의 시작으로 본다
  // ('sLLM'·'vLLM'의 LLM, 'eGPU'의 GPU). 대소문자를 구분해 검사하므로
  // 'SKT'의 KT(앞이 대문자)나 'risk'의 sk(소문자)는 여기 걸리지 않는다.
  return /^[A-Z]/.test(keyword) && new RegExp(`(?<=[a-z])${escaped}`).test(title);
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
    .replace(/\.{2,}$|…+$/, '') // Google RSS 말줄임 제거
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

// ── Search queries ───────────────────────────────────────────────────────────
// Multiple queries widen the pool: Google News RSS caps each query at ~100 items
// and Naver's API caps display at 100, so splitting keywords across queries
// raises the ceiling. Dedup downstream removes overlaps.
export const GOOGLE_QUERIES = [
  '(AI OR 인공지능)',
  '(생성형 AI OR LLM OR AI 에이전트 OR AI 반도체)',
  '(챗GPT OR ChatGPT OR 오픈AI OR OpenAI)',
  '(엔비디아 OR HBM OR AI 반도체 OR AI 칩)',
  '(구글 AI OR 제미나이 OR 클로드 OR 코파일럿)',
];

// Naver treats spaces as OR within a query.
export const NAVER_QUERIES = [
  'AI 인공지능',
  '생성형AI LLM',
  '챗GPT 오픈AI',
  '엔비디아 AI반도체',
  '제미나이 클로드',
];

// ── AI relevance gate ────────────────────────────────────────────────────────
// Output-side whitelist: a title must match at least one pattern to be kept.
// "AI" alone is permitted when not glued to other Latin letters (so MAIL, FAIR
// don't match); Korean adjacency is intentionally allowed.
const AI_RELEVANCE_PATTERNS: RegExp[] = [
  /(?<![A-Za-z])AI(?![A-Za-z])/,
  /인공지능|생성형|초거대|거대언어모델|범용인공지능|AGI/,
  /\bLLM\b|\bSLM\b|\bRAG\b|\bMCP\b/i,
  /GPT|챗지피티|챗GPT|ChatGPT/i,
  /오픈AI|OpenAI|앤스로픽|Anthropic|클로드|Claude/i,
  /제미나이|Gemini|코파일럿|Copilot|미스트랄|Mistral|라마|Llama|딥시크|DeepSeek|그록|Grok/i,
  /딥러닝|머신러닝|기계학습|뉴럴넷|신경망|파운데이션\s*모델|파인튜닝|임베딩|벡터\s*DB/,
  /엔비디아|NVIDIA|HBM|NPU|TPU|AI\s*반도체|AI\s*칩|AI\s*가속기/i,
  /에이전트(?:\s*AI|틱)|에이전틱|Agentic/i,
  /Sora|미드저니|Midjourney|스테이블\s*디퓨전|Stable\s*Diffusion/i,
  /텍스트\s*투\s*이미지|이미지\s*생성\s*AI/i,
];

export function isAiRelated(title: string): boolean {
  return AI_RELEVANCE_PATTERNS.some(re => re.test(title));
}

// ── Tag matching ──────────────────────────────────────────────────────────────
// A tag matches when any keyword hits exactly (word-boundary). A partial match
// also counts unless an excludeKeyword is present. Shared by both collectors so
// Google and Naver articles tag identically.
export function matchTags(title: string, tagSpecs: TagSpec[]): {
  tags: string[];
  categories: string[];
  matchedTerms: string[];
} {
  const tags: string[] = [];
  const categories: string[] = [];
  const matchedTerms: string[] = [];

  tagSpecs.forEach(tag => {
    const hasExactMatch = tag.keywords.some(kw => isExactMatch(title, kw));
    const hasPartialMatch = !hasExactMatch && tag.keywords.some(kw => isPartialMatch(title, kw));
    const isExcluded = (tag.excludeKeywords ?? []).some(kw => isPartialMatch(title, kw));
    const isMatched = hasExactMatch || (hasPartialMatch && !isExcluded);
    if (isMatched) {
      if (!tags.includes(tag.name)) tags.push(tag.name);
      if (!categories.includes(tag.category)) categories.push(tag.category);
      matchedTerms.push(tag.name);
    }
  });

  return { tags, categories, matchedTerms };
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

  const { tags, categories, matchedTerms } = matchTags(title, tagSpecs);

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
      return !Number.isNaN(pubDate.getTime()) && getKstDateStr(pubDate) === targetDateStr;
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

  const { tags, categories, matchedTerms } = matchTags(rawTitle, tagSpecs);

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
  const seenTitleKeys: string[] = [];

  return function add(article: { id: string; title: string }): boolean {
    if (seenIds.has(article.id)) return false;
    const titleKey = normalizeTitle(article.title);
    // 정확 일치 또는 prefix 겹침(≥20자) — Google RSS 말줄임 잘림 대응
    const isDup = seenTitleKeys.some(seen => {
      if (seen === titleKey) return true;
      const shorter = seen.length <= titleKey.length ? seen : titleKey;
      const longer = seen.length <= titleKey.length ? titleKey : seen;
      return shorter.length >= 20 && longer.startsWith(shorter);
    });
    if (isDup) return false;
    seenIds.add(article.id);
    seenTitleKeys.push(titleKey);
    return true;
  };
}
