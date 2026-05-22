import { get } from '@vercel/edge-config';
import { DEFAULT_TAGS, DEFAULT_CATEGORIES, type TagSpec, type CategoryDef } from '../lib/apiConstants.js';

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
      const { name, category, keywords, excludeKeywords } = req.body;
      if (!name || !category) return res.status(400).json({ error: 'name and category are required' });

      const [tags, categories] = await Promise.all([getTagsFromConfig(), getCategoriesFromConfig()]);
      const id = slugify(name) || `tag-${Date.now()}`;

      if (tags.some(t => t.id === id)) {
        return res.status(409).json({ error: `Tag with id "${id}" already exists` });
      }

      const newTag: TagSpec = { id, name: name.trim(), category, keywords: keywords ?? [], ...(excludeKeywords !== undefined && { excludeKeywords }) };
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
