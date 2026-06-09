import { Article, FetchNewsResponse } from '../types';

export async function getNews(date?: string): Promise<FetchNewsResponse> {
  const url = date ? `/api/news?date=${date}` : '/api/news';
  const res = await fetch(url);
  if (!res.ok) throw new Error('뉴스 조회 실패');
  return res.json();
}
