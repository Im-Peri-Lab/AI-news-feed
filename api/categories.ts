import { getCategoriesFromConfig, updateEdgeConfigKey, COLOR_PALETTE } from './_edgeConfig';
import type { CategoryDef } from './_edgeConfig';

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
