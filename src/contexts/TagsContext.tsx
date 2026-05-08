import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TagSpec, CategoryDef } from '../types';
import { TAGS, DEFAULT_CATEGORIES, CATEGORY_COLORS } from '../constants/tags';

interface TagsContextValue {
  tags: TagSpec[];
  categories: CategoryDef[];
  isLoading: boolean;
  getCategoryColor: (categoryName: string) => { bg: string; text: string; border: string };
  refresh: () => Promise<void>;
}

const UNCLASSIFIED_COLOR = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

const TagsContext = createContext<TagsContextValue>({
  tags: TAGS,
  categories: DEFAULT_CATEGORIES,
  isLoading: false,
  getCategoryColor: (name) => CATEGORY_COLORS[name] ?? UNCLASSIFIED_COLOR,
  refresh: async () => {},
});

export function TagsProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<TagSpec[]>(TAGS);
  const [categories, setCategories] = useState<CategoryDef[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) return;
      const data = await res.json();
      if (data.tags) setTags(data.tags);
      if (data.categories) setCategories(data.categories);
    } catch {
      // fall back to defaults already set
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getCategoryColor = useCallback((categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    if (cat) return cat.color;
    return CATEGORY_COLORS[categoryName] ?? UNCLASSIFIED_COLOR;
  }, [categories]);

  return (
    <TagsContext.Provider value={{ tags, categories, isLoading, getCategoryColor, refresh: fetchData }}>
      {children}
    </TagsContext.Provider>
  );
}

export function useTags() {
  return useContext(TagsContext);
}
