import { get } from '@vercel/edge-config';

interface CategoryDef { id: string; name: string; color: { bg: string; text: string; border: string }; }

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'tech', name: '기술', color: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' } },
  { id: 'model', name: '모델', color: { bg: 'bg-brand-light', text: 'text-brand', border: 'border-brand/20' } },
  { id: 'global', name: '글로벌', color: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' } },
  { id: 'domestic', name: '국내', color: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' } },
];

const COLOR_PALETTE = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
  { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
  { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-100' },
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
  if (req.method === 'POST') {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const categories = await getCategoriesFromConfig();
      const id = slugify(name) || `cat-${Date.now()}`;

      if (categories.some(c => c.id === id)) {
        return res.status(409).json({ error: `Category with id "${id}" already exists` });
      }

      const color = COLOR_PALETTE[categories.length % COLOR_PALETTE.length];
      const newCategory: CategoryDef = { id, name: name.trim(), color };
      await updateEdgeConfigKey('categories', [...categories, newCategory]);
      return res.status(201).json(newCategory);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
