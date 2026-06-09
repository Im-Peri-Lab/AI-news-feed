import { type CategoryDef } from '../lib/apiConstants.js';
import { pickColor } from '../lib/colorPalette.js';
import { getCategories, writeEdgeConfigKey, slugify } from '../lib/edgeConfig.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const categories = await getCategories();
      const id = slugify(name) || `cat-${Date.now()}`;

      if (categories.some(c => c.id === id)) {
        return res.status(409).json({ error: `Category with id "${id}" already exists` });
      }

      const color = pickColor(categories.map((c) => c.color));
      const newCategory: CategoryDef = { id, name: name.trim(), color };
      await writeEdgeConfigKey('categories', [...categories, newCategory]);
      return res.status(201).json(newCategory);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { categories } = req.body;
      if (!Array.isArray(categories)) return res.status(400).json({ error: 'categories array required' });
      await writeEdgeConfigKey('categories', categories);
      return res.json({ categories });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
