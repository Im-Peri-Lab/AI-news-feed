import { TagSpec, CategoryDef } from '../types';

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function fetchTagsAndCategories(): Promise<{ tags: TagSpec[]; categories: CategoryDef[] }> {
  return request('/api/tags', 'GET');
}

export async function createTag(data: { name: string; category: string; keywords: string[] }): Promise<TagSpec> {
  return request('/api/tags', 'POST', data);
}

export async function updateTag(id: string, data: Partial<{ name: string; category: string; keywords: string[] }>): Promise<TagSpec> {
  return request(`/api/tags/${id}`, 'PUT', data);
}

export async function deleteTag(id: string): Promise<void> {
  return request(`/api/tags/${id}`, 'DELETE');
}

export async function createCategory(name: string): Promise<CategoryDef> {
  return request('/api/categories', 'POST', { name });
}

export async function updateCategory(id: string, name: string): Promise<CategoryDef> {
  return request(`/api/categories/${id}`, 'PUT', { name });
}

export async function deleteCategory(id: string): Promise<void> {
  return request(`/api/categories/${id}`, 'DELETE');
}
