import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TagSpec, CategoryDef } from '../types';
import { CATEGORY_COLORS } from '../constants/tags';

interface TagsContextValue {
  tags: TagSpec[];
  categories: CategoryDef[];
  isLoading: boolean;
  getCategoryColor: (categoryName: string) => { bg: string; text: string; border: string };
  refresh: () => Promise<void>;
  mutateTags: (updater: (prev: TagSpec[]) => TagSpec[]) => void;
  mutateCategories: (updater: (prev: CategoryDef[]) => CategoryDef[]) => void;
}

const UNCLASSIFIED_COLOR = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

const TagsContext = createContext<TagsContextValue>({
  tags: [],
  categories: [],
  isLoading: true,
  getCategoryColor: (name) => CATEGORY_COLORS[name] ?? UNCLASSIFIED_COLOR,
  refresh: async () => {},
  mutateTags: () => {},
  mutateCategories: () => {},
});

export function TagsProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<TagSpec[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) return;
      const data = await res.json();
      if (data.tags) setTags(data.tags);
      if (data.categories) setCategories(data.categories);
    } catch {
      // fall back to empty — UI shows loading state until resolved
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

  const mutateTags = useCallback((updater: (prev: TagSpec[]) => TagSpec[]) => {
    setTags(updater);
  }, []);

  const mutateCategories = useCallback((updater: (prev: CategoryDef[]) => CategoryDef[]) => {
    setCategories(updater);
  }, []);

  return (
    <TagsContext.Provider value={{ tags, categories, isLoading, getCategoryColor, refresh: fetchData, mutateTags, mutateCategories }}>
      {children}
    </TagsContext.Provider>
  );
}

export function useTags() {
  return useContext(TagsContext);
}
