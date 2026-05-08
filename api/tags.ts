import { getTagsFromConfig, getCategoriesFromConfig, updateEdgeConfigKey, DEFAULT_CATEGORIES, TagSpec } from '../lib/edgeConfig';

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
      return res.status(500).json({ error: e.message });
    }
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

  return res.status(405).json({ error: 'Method not allowed' });
}
