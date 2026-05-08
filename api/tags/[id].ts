import { getTagsFromConfig, updateEdgeConfigKey } from '../_edgeConfig';

export default async function handler(req: any, res: any) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });

  if (req.method === 'PUT') {
    try {
      const tags = await getTagsFromConfig();
      const idx = tags.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Tag not found' });

      const { name, category, keywords } = req.body;
      tags[idx] = {
        ...tags[idx],
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category }),
        ...(keywords !== undefined && { keywords }),
      };
      await updateEdgeConfigKey('tags', tags);
      return res.json(tags[idx]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const tags = await getTagsFromConfig();
      const updated = tags.filter(t => t.id !== id);
      if (updated.length === tags.length) return res.status(404).json({ error: 'Tag not found' });
      await updateEdgeConfigKey('tags', updated);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
