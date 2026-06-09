import { type TagSpec } from '../lib/apiConstants.js';
import { getTags, getCategories, writeEdgeConfigKey, slugify } from '../lib/edgeConfig.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const [tags, categories] = await Promise.all([getTags(), getCategories()]);
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

      const tags = await getTags();
      const id = slugify(name) || `tag-${Date.now()}`;

      if (tags.some(t => t.id === id)) {
        return res.status(409).json({ error: `Tag with id "${id}" already exists` });
      }

      const newTag: TagSpec = { id, name: name.trim(), category, keywords: keywords ?? [], ...(excludeKeywords !== undefined && { excludeKeywords }) };
      await writeEdgeConfigKey('tags', [...tags, newTag]);
      return res.status(201).json(newTag);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { tags } = req.body;
      if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags array required' });
      await writeEdgeConfigKey('tags', tags);
      return res.json({ tags });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
