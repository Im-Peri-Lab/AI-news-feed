import { type TagSpec, type CategoryDef } from '../lib/apiConstants.js';

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

async function readEdgeConfigKey<T>(key: string): Promise<T | null> {
  const edgeConfigId = getEdgeConfigId();
  const token = process.env.VERCEL_API_TOKEN;
  if (!edgeConfigId || !token) return null;
  try {
    const res = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.value ?? null) as T | null;
  } catch {
    return null;
  }
}

async function getTagsFromConfig(): Promise<TagSpec[]> {
  const tags = await readEdgeConfigKey<TagSpec[]>('tags');
  if (!tags) throw new Error('No tags found in Edge Config');
  return tags;
}

async function getCategoriesFromConfig(): Promise<CategoryDef[]> {
  const categories = await readEdgeConfigKey<CategoryDef[]>('categories');
  if (!categories) throw new Error('No categories found in Edge Config');
  return categories;
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
    try {
      const [tags, categories] = await Promise.all([getTagsFromConfig(), getCategoriesFromConfig()]);
      return res.json({ tags, categories });
    } catch (e: any) {
      console.error('[api/tags] Edge Config load failed:', e.message);
      return res.status(503).json({ error: 'Tag data unavailable', detail: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, category, keywords, excludeKeywords } = req.body;
      if (!name || !category) return res.status(400).json({ error: 'name and category are required' });

      const tags = await getTagsFromConfig();
      const id = slugify(name) || `tag-${Date.now()}`;

      if (tags.some(t => t.id === id)) {
        return res.status(409).json({ error: `Tag with id "${id}" already exists` });
      }

      const newTag: TagSpec = { id, name: name.trim(), category, keywords: keywords ?? [], ...(excludeKeywords !== undefined && { excludeKeywords }) };
      await updateEdgeConfigKey('tags', [...tags, newTag]);
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
