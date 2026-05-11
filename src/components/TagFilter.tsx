import { useTags } from '../contexts/TagsContext';
import { cn } from '../lib/utils';
import { X, Filter } from 'lucide-react';

interface TagFilterProps {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
}

export default function TagFilter({
  selectedTags,
  setSelectedTags,
  activeCategory,
  setActiveCategory
}: TagFilterProps) {
  const { tags, categories, getCategoryColor } = useTags();

  const allCategories = ['전체', ...categories.map(c => c.name)];

  const displayedTags = activeCategory === '전체'
    ? [
        ...categories.flatMap(c => tags.filter(t => t.category === c.name)),
        ...tags.filter(t => !categories.find(c => c.name === t.category)),
      ]
    : tags.filter(t => t.category === activeCategory);

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter(t => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const removeTag = (tagName: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tagName));
  };

  const clearAll = () => {
    setSelectedTags([]);
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Category Tabs Wrapper */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide mb-4 touch-pan-x">
        <Filter className="w-4 h-4 text-gray-400 shrink-0 ml-1 translate-y-[1px]" />
        <nav className="flex gap-5 md:gap-9">
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "relative px-1 py-3 text-[13px] md:text-sm font-extrabold transition-all whitespace-nowrap flex items-center gap-2.5",
                activeCategory === cat
                  ? "text-brand dark:text-brand after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-brand after:rounded-full"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              {cat}
            </button>
          ))}
        </nav>
      </div>

      {/* Tag Chips Selection Area */}
      <div className="flex gap-2 px-1 overflow-x-auto pb-2 md:pb-3 scrollbar-hide touch-pan-x">
        {displayedTags.map(tag => {
          const isActive = selectedTags.includes(tag.name);
          const activeColor = getCategoryColor(tag.category);

          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.name)}
              className={cn(
                "inline-flex items-center justify-center px-3 py-1 rounded-full text-[12px] md:text-[13px] font-bold border transition-all whitespace-nowrap",
                isActive
                  ? cn(activeColor.bg, activeColor.text, activeColor.border)
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300"
              )}
            >
              {tag.name}
            </button>
          );
        })}
      </div>

      {/* Selected Tags Area - Shown Only if tags are selected */}
      {selectedTags.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">선택된 태그</span>
            <button
              onClick={clearAll}
              className="text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              전체 초기화
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-x-visible scrollbar-none">
            {selectedTags.map(tagName => {
              const tag = tags.find(t => t.name === tagName);
              const color = getCategoryColor(tag?.category ?? '');
              return (
                <span
                  key={tagName}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border shrink-0",
                    color.bg, color.text, color.border
                  )}
                >
                  {tagName}
                  <button onClick={() => removeTag(tagName)} className="p-0.5 hover:bg-black/5 rounded">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
