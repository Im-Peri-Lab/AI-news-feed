export interface TagSpec {
  id: string;
  name: string;
  category: string;
  keywords: string[];
}

export interface CategoryDef {
  id: string;
  name: string;
  color: { bg: string; text: string; border: string };
}

export interface Article {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  source: string;
  publishedAt: string;
  publishedDate: string;
  tags: string[];
  categories: string[];
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
