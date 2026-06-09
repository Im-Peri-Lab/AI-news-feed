import { getTags, getCategories, writeEdgeConfigKey } from '../../lib/edgeConfig.js';

export default async function handler(req: any, res: any) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });

  if (req.method === 'PUT') {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const categories = await getCategories();
      const idx = categories.findIndex(c => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Category not found' });

      const oldName = categories[idx].name;
      categories[idx] = { ...categories[idx], name: name.trim() };

      // Update tags that reference the old category name
      const tags = await getTags();
      const updatedTags = tags.map(t => t.category === oldName ? { ...t, category: name.trim() } : t);

      await Promise.all([
        writeEdgeConfigKey('categories', categories),
        writeEdgeConfigKey('tags', updatedTags),
      ]);
      return res.json(categories[idx]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const [categories, tags] = await Promise.all([getCategories(), getTags()]);
      const cat = categories.find(c => c.id === id);
      if (!cat) return res.status(404).json({ error: 'Category not found' });

      const updatedCategories = categories.filter(c => c.id !== id);
      const updatedTags = tags.map(t => t.category === cat.name ? { ...t, category: '미분류' } : t);

      await Promise.all([
        writeEdgeConfigKey('categories', updatedCategories),
        writeEdgeConfigKey('tags', updatedTags),
      ]);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
