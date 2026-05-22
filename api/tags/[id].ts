import { type TagSpec } from '../../lib/apiConstants.js';

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

export default async function handler(req: any, res: any) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });

  if (req.method === 'PUT') {
    try {
      const tags = await getTagsFromConfig();
      const idx = tags.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Tag not found' });

      const { name, category, keywords, excludeKeywords } = req.body;
      tags[idx] = {
        ...tags[idx],
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category }),
        ...(keywords !== undefined && { keywords }),
        ...(excludeKeywords !== undefined && { excludeKeywords }),
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
