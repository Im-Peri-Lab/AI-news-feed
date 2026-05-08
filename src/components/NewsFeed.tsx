import { useEffect, useState, useMemo } from 'react';
import { getNews, refreshNews } from '../services/newsService';
import { Article } from '../types';
import NewsCard from './NewsCard';
import TagFilter from './TagFilter';
import DateNavigation from './DateNavigation';
import { Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function NewsFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadNews = async (date: Date) => {
    setIsLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const data = await getNews(dateStr);
      setArticles(data.articles);
      if (data.articles.length > 0) {
        setLastUpdated(format(new Date(), 'yyyy.MM.dd HH:mm'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNews(currentDate);
  }, [currentDate]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNews();
      await loadNews(currentDate);
    } catch (e) {
      console.error(e);
      alert('뉴스 수집 중 오류가 발생했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      // Search filter (AND)
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        article.title.toLowerCase().includes(searchLower) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchLower));

      // Tag filter (OR between selected tags)
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => article.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  }, [articles, search, selectedTags]);

  return (
    <div className="w-full">
      <DateNavigation 
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
      />

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-gray-400" />
        <input 
          type="text" 
          placeholder="기사 제목 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 md:h-14 pl-12 md:pl-14 pr-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl text-[15px] md:text-lg outline-none focus:border-brand transition-all shadow-sm dark:text-white"
        />
        {search && (
          <button 
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        )}
      </div>

      <TagFilter 
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />

      <div className="flex justify-between items-center mb-5 px-1 relative z-10">
        <div className="text-[13px] md:text-sm font-black text-gray-900 dark:text-white">
          총 <span className="text-brand">{filteredArticles.length}</span>건
        </div>
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          최신순
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 rounded-2xl shadow-sm relative overflow-hidden bg-white dark:bg-gray-800">
          <AnimatePresence>
            {filteredArticles.length > 0 ? (
              filteredArticles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                >
                  <NewsCard 
                    article={article} 
                    isFirst={index === 0}
                    isLast={index === filteredArticles.length - 1}
                    onMenuToggle={(isOpen) => setOpenMenuId(isOpen ? article.id : null)}
                  />
                </motion.div>
              ))
            ) : (
              <div className="bg-white dark:bg-gray-800 py-20 text-center text-gray-500 font-medium">
                표시할 뉴스가 없습니다.
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
