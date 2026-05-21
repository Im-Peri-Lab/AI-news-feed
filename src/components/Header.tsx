import { Moon, Sun, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export default function Header({ onOpenSettings }: HeaderProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <header className="relative flex flex-row items-center md:items-end justify-between gap-6 mb-6 md:mb-10 pb-8 border-b border-gray-100 dark:border-gray-800">
      <div className="title-area flex flex-col gap-2 min-w-0">
        <div className="hidden md:flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-brand rounded-full"></span>
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Curated Intelligence</span>
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
            AI<span className="text-brand mx-0.5">/</span>AX NEWS FEED
          </h1>
          <p className="hidden md:block mt-3 text-[13px] md:text-base text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-[280px] md:max-w-none">
            인공지능과 디지털 혁신의 흐름을 <br className="md:hidden" /> 가장 명확한 시선으로 읽어드립니다.
          </p>
        </div>
      </div>

      <div className="z-10 flex items-center gap-2.5 md:gap-2 md:self-start shrink-0">
        <button
          onClick={onOpenSettings}
          className="group inline-flex items-center text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-all p-1 md:p-0 md:gap-2.5 md:px-4 md:py-2.5 md:rounded-full md:bg-white/80 md:dark:bg-gray-900/80 md:backdrop-blur-sm md:border md:border-gray-100 md:dark:border-gray-800 md:hover:border-brand/30 md:font-bold md:text-[11px]"
          title="태그 관리"
        >
          {/* Mobile: visible 36px circle chrome wraps the icon. Desktop: md:contents
              dissolves this wrapper so the icon flows into the pill on the button itself. */}
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-100 dark:border-gray-800 shadow-sm md:contents">
            <Settings className="w-5 md:w-3.5 h-5 md:h-3.5 transition-transform group-hover:rotate-45" />
          </span>
          <span className="uppercase tracking-widest hidden md:inline">Tags</span>
        </button>
        <button
          onClick={() => setIsDark(!isDark)}
          className="group inline-flex items-center text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-all p-1 md:p-0 md:gap-2.5 md:px-4 md:py-2.5 md:rounded-full md:bg-white/80 md:dark:bg-gray-900/80 md:backdrop-blur-sm md:border md:border-gray-100 md:dark:border-gray-800 md:hover:border-brand/30 md:font-bold md:text-[11px]"
          title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-100 dark:border-gray-800 shadow-sm md:contents">
            {isDark ? (
              <Sun className="w-5 md:w-3.5 h-5 md:h-3.5 transition-transform group-hover:rotate-45" />
            ) : (
              <Moon className="w-5 md:w-3.5 h-5 md:h-3.5 transition-transform group-hover:-rotate-12" />
            )}
          </span>
          <span className="uppercase tracking-widest hidden md:inline">{isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </header>
  );
}
