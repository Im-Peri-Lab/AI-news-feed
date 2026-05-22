import { type TagSpec, type CategoryDef } from '../../lib/apiConstants.js';
import { getEdgeConfigId } from '../../lib/newsUtils.js';

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

// The @vercel/edge-config SDK reads through a CDN cache that lags writes by
// hundreds of milliseconds. Mutation handlers must use the Management API directly.
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

export default async function handler(req: any, res: any) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });

  if (req.method === 'PUT') {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const categories = await getCategoriesFromConfig();
      const idx = categories.findIndex(c => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Category not found' });

      const oldName = categories[idx].name;
      categories[idx] = { ...categories[idx], name: name.trim() };

      // Update tags that reference the old category name
      const tags = await getTagsFromConfig();
      const updatedTags = tags.map(t => t.category === oldName ? { ...t, category: name.trim() } : t);

      await Promise.all([
        updateEdgeConfigKey('categories', categories),
        updateEdgeConfigKey('tags', updatedTags),
      ]);
      return res.json(categories[idx]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const [categories, tags] = await Promise.all([getCategoriesFromConfig(), getTagsFromConfig()]);
      const cat = categories.find(c => c.id === id);
      if (!cat) return res.status(404).json({ error: 'Category not found' });

      const updatedCategories = categories.filter(c => c.id !== id);
      const updatedTags = tags.map(t => t.category === cat.name ? { ...t, category: '미분류' } : t);

      await Promise.all([
        updateEdgeConfigKey('categories', updatedCategories),
        updateEdgeConfigKey('tags', updatedTags),
      ]);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
