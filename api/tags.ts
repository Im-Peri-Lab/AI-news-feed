import { getTagsFromConfig, getCategoriesFromConfig, updateEdgeConfigKey } from '../lib/edgeConfig';
import { TAGS as DEFAULT_TAGS, DEFAULT_CATEGORIES } from '../src/constants/tags';
import type { TagSpec } from '../src/types';

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

  return res.status(405).json({ error: 'Method not allowed' });
}
