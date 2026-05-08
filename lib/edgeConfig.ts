export interface TagSpec {
  id: string;
  name: string;
  category: string;
  keywords: string[];
}

export interface CategoryDef {
  id: string;
  name: string;
  color: { bg: string; text: string; border: string };
}

export const DEFAULT_TAGS: TagSpec[] = [
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

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'tech', name: '기술', color: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' } },
  { id: 'model', name: '모델', color: { bg: 'bg-brand-light', text: 'text-brand', border: 'border-brand/20' } },
  { id: 'global', name: '글로벌', color: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' } },
  { id: 'domestic', name: '국내', color: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' } },
];

export const COLOR_PALETTE = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
  { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
  { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-100' },
];

export const UNCLASSIFIED_COLOR = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

function parseEdgeConfigConn(): { configId: string; token: string } | null {
  const conn = process.env.EDGE_CONFIG;
  if (!conn) return null;
  try {
    const url = new URL(conn);
    const token = url.searchParams.get('token');
    const configId = url.pathname.replace(/^\//, '');
    if (!token || !configId) return null;
    return { configId, token };
  } catch {
    return null;
  }
}

function getEdgeConfigId(): string {
  const conn = process.env.EDGE_CONFIG || '';
  const match = conn.match(/ecfg_[a-zA-Z0-9]+/);
  return match ? match[0] : '';
}

async function readEdgeConfigItem<T>(key: string): Promise<T | null> {
  const parsed = parseEdgeConfigConn();
  if (!parsed) return null;
  const { configId, token } = parsed;
  try {
    const res = await fetch(
      `https://edge-config.vercel.com/${configId}/item/${key}?token=${token}`
    );
    if (!res.ok) {
      console.error(`[edgeConfig] read "${key}" failed: ${res.status}`);
      return null;
    }
    return res.json() as Promise<T>;
  } catch (e) {
    console.error(`[edgeConfig] read "${key}" error:`, e);
    return null;
  }
}

export async function getTagsFromConfig(): Promise<TagSpec[]> {
  try {
    const tags = await readEdgeConfigItem<TagSpec[]>('tags');
    return tags ?? DEFAULT_TAGS;
  } catch (e) {
    console.error('[edgeConfig] getTagsFromConfig failed:', e);
    return DEFAULT_TAGS;
  }
}

export async function getCategoriesFromConfig(): Promise<CategoryDef[]> {
  try {
    const categories = await readEdgeConfigItem<CategoryDef[]>('categories');
    return categories ?? DEFAULT_CATEGORIES;
  } catch (e) {
    console.error('[edgeConfig] getCategoriesFromConfig failed:', e);
    return DEFAULT_CATEGORIES;
  }
}

export async function updateEdgeConfigKey(key: string, value: unknown): Promise<void> {
  const edgeConfigId = getEdgeConfigId();
  const token = process.env.VERCEL_API_TOKEN;
  if (!edgeConfigId || !token) throw new Error('Edge Config not configured (missing EDGE_CONFIG or VERCEL_API_TOKEN)');

  const res = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: [{ operation: 'upsert', key, value }] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge Config update failed: ${res.status} ${text}`);
  }
}
