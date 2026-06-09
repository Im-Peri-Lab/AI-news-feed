import { type TagSpec, type CategoryDef } from './apiConstants.js';

// Single source for Vercel Edge Config access. Read handlers and mutation
// handlers both go through here so the URL shape, auth, and error handling
// stay in one place.

export function getEdgeConfigId(): string {
  const match = (process.env.EDGE_CONFIG || '').match(/ecfg_[a-zA-Z0-9]+/);
  return match ? match[0] : '';
}

// The @vercel/edge-config SDK reads through a CDN cache that lags writes by
// hundreds of milliseconds. We hit the Management API directly so mutation
// handlers read their own writes back consistently.
export async function readEdgeConfigKey<T>(key: string): Promise<T | null> {
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

// Read a key via the EDGE_CONFIG connection string (the cached CDN endpoint the
// @vercel/edge-config SDK uses). Unlike readEdgeConfigKey this needs no
// VERCEL_API_TOKEN — the read token is embedded in the connection string — so it
// works locally where the Management API token (a Sensitive var) isn't available.
// Trade-off: this CDN read lags writes by ~hundreds of ms, so it's only safe for
// read-only paths (news), not read-after-write mutation handlers.
// Note: the connection-string endpoint returns the stored value directly, not
// wrapped in `{ value }` like the Management API.
export async function readEdgeConfigKeyCached<T>(key: string): Promise<T | null> {
  const conn = process.env.EDGE_CONFIG || '';
  if (!conn) return null;
  try {
    const url = new URL(conn);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/item/${key}`;
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return (data ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function writeEdgeConfigKey(key: string, value: unknown): Promise<void> {
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

export async function getTags(): Promise<TagSpec[]> {
  const tags = await readEdgeConfigKey<TagSpec[]>('tags');
  if (!tags) throw new Error('No tags found in Edge Config');
  return tags;
}

// Same contract as getTags (throws if missing) but reads via the connection
// string, so it works without VERCEL_API_TOKEN. Use on read-only paths only.
export async function getTagsCached(): Promise<TagSpec[]> {
  const tags = await readEdgeConfigKeyCached<TagSpec[]>('tags');
  if (!tags) throw new Error('No tags found in Edge Config');
  return tags;
}

export async function getCategories(): Promise<CategoryDef[]> {
  const categories = await readEdgeConfigKey<CategoryDef[]>('categories');
  if (!categories) throw new Error('No categories found in Edge Config');
  return categories;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
