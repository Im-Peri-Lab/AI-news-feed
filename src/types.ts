export enum Category {
  ALL = '전체',
  GLOBAL = '글로벌',
  DOMESTIC = '국내',
  TECH = '기술',
  MODEL = '모델',
}

export interface TagSpec {
  id: string;
  name: string;
  category: Category;
  keywords: string[];
}

export interface Article {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  source: string;
  publishedAt: string; // ISO string
  publishedDate: string; // YYYY-MM-DD
  tags: string[];
  categories: Category[];
  matchedTerms: string[];
  collector: string;
  fetchedAt: string;
}

export interface FetchNewsResponse {
  total: number;
  articles: Article[];
}

declare global {
  interface Window {
    Kakao: any;
  }
}
