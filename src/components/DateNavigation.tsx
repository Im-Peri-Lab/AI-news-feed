import { Calendar, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRef } from 'react';

interface DateNavigationProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: string;
}

export default function DateNavigation({ 
  currentDate, 
  setCurrentDate, 
  onRefresh, 
  isRefreshing,
  lastUpdated
}: DateNavigationProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const formattedDate = format(currentDate, 'yyyy.MM.dd (eee)', { locale: ko });
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
      <div className="flex items-center gap-2 flex-1 md:flex-none">
        <div className="flex items-center gap-1 border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 rounded-2xl px-2 h-12 md:h-14 flex-1 md:flex-none relative overflow-hidden shadow-sm">
          <button 
            onClick={() => setCurrentDate(subDays(currentDate, 1))}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <div 
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="flex-1 flex items-center justify-center gap-2 px-1 font-bold text-[15px] md:text-lg text-gray-900 dark:text-white whitespace-nowrap relative cursor-pointer group"
          >
            <Calendar className="w-4 h-4 text-brand" />
            <span>{formattedDate}</span>
            <input 
              ref={dateInputRef}
              type="date"
              value={format(currentDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                // 'YYYY-MM-DD' parsed as UTC midnight — append T00:00:00 to force local time
                if (e.target.value) setCurrentDate(new Date(e.target.value + 'T00:00:00'));
              }}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
              title="날짜 선택"
            />
          </div>

          <button 
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
            disabled={isToday}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <button 
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-2 font-bold px-4 md:px-6 h-12 md:h-14 bg-brand hover:bg-brand-hover text-white rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-light dark:shadow-none shrink-0"
        >
          <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm md:text-base">{isRefreshing ? '수집중' : '조회'}</span>
        </button>
      </div>

      <div className="flex items-center justify-end px-1 shrink-0">
        <span className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 font-medium">최근 업데이트: {lastUpdated || '-'}</span>
      </div>
    </div>
  );
}
