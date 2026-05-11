import { get } from '@vercel/edge-config';

interface TagSpec { id: string; name: string; category: string; keywords: string[]; }
interface CategoryDef { id: string; name: string; color: { bg: string; text: string; border: string }; }

const DEFAULT_TAGS: TagSpec[] = [
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

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'tech', name: '기술', color: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' } },
  { id: 'model', name: '모델', color: { bg: 'bg-brand-light', text: 'text-brand', border: 'border-brand/20' } },
  { id: 'global', name: '글로벌', color: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' } },
  { id: 'domestic', name: '국내', color: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' } },
];

function getEdgeConfigId(): string {
  const match = (process.env.EDGE_CONFIG || '').match(/ecfg_[a-zA-Z0-9]+/);
  return match ? match[0] : '';
}

async function updateEdgeConfigKey(key: string, value: unknown): Promise<void> {
  const edgeConfigId = getEdgeConfigId();
  const token = process.env.VERCEL_API_TOKEN;
  if (!edgeConfigId || !token) throw new Error('Edge Config not configured');
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ operation: 'upsert', key, value }] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge Config update failed: ${res.status} ${text}`);
  }
}

async function getTagsFromConfig(): Promise<TagSpec[]> {
  try { return (await get<TagSpec[]>('tags')) ?? DEFAULT_TAGS; } catch { return DEFAULT_TAGS; }
}

async function getCategoriesFromConfig(): Promise<CategoryDef[]> {
  try { return (await get<CategoryDef[]>('categories')) ?? DEFAULT_CATEGORIES; } catch { return DEFAULT_CATEGORIES; }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    let tags = DEFAULT_TAGS;
    let categories = DEFAULT_CATEGORIES;
    let edgeConfigError: string | null = null;

    try {
      [tags, categories] = await Promise.all([getTagsFromConfig(), getCategoriesFromConfig()]);
    } catch (e: any) {
      edgeConfigError = e?.message ?? String(e);
      console.error('[api/tags] Edge Config load failed, using defaults:', edgeConfigError);
    }

    return res.json({
      tags,
      categories,
      ...(edgeConfigError && { _edgeConfigError: edgeConfigError }),
    });
  }

  if (req.method === 'POST') {
    try {
      const { name, category, keywords } = req.body;
      if (!name || !category) return res.status(400).json({ error: 'name and category are required' });

      const [tags, categories] = await Promise.all([getTagsFromConfig(), getCategoriesFromConfig()]);
      const id = slugify(name) || `tag-${Date.now()}`;

      if (tags.some(t => t.id === id)) {
        return res.status(409).json({ error: `Tag with id "${id}" already exists` });
      }

      const newTag: TagSpec = { id, name: name.trim(), category, keywords: keywords ?? [] };
      await updateEdgeConfigKey('tags', [...tags, newTag]);
      // Ensure categories are persisted too
      if (categories === DEFAULT_CATEGORIES) await updateEdgeConfigKey('categories', DEFAULT_CATEGORIES);
      return res.status(201).json(newTag);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { tags } = req.body;
      if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags array required' });
      await updateEdgeConfigKey('tags', tags);
      return res.json({ tags });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
