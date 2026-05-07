import { ExternalLink, Link2, Share2 } from 'lucide-react';
import { Article, Category } from '../types';
import { TAGS, CATEGORY_COLORS } from '../constants/tags';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState, useRef, useEffect } from 'react';

function KakaoIcon() {
  return (
    <div className="w-5 h-5 shrink-0 overflow-hidden rounded-md flex items-center justify-center bg-[#FEE500]">
      <svg viewBox="0 0 48 48" className="w-full h-full p-0.5">
        <path d="M24 10c-8.837 0-16 5.671-16 12.667 0 4.542 3.056 8.52 7.643 10.74l-1.94 7.108c-.12.438.39.814.767.565l8.36-5.514c.386.046.777.068 1.17.068 8.837 0 16-5.671 16-12.667S32.837 10 24 10z" fill="#3C1E1E"/>
      </svg>
    </div>
  );
}

function TeamsIcon() {
  return (
    <div className="w-5 h-5 shrink-0 overflow-hidden rounded-md flex items-center justify-center bg-[#4B53BC]">
      <svg viewBox="0 0 24 24" className="w-full h-full p-0.5">
        <path fill="#FFF" d="M11.5 6.5s.5-.5 1.5-.5 1.5.5 1.5.5V11s1 0 1.5.5 1 2 1 2 .5 1 .5 2v3h-5.5v-3s0-1 .5-2 1.5-3 1.5-3H11v-4h.5zM7 9h4v8H7V9z"/>
      </svg>
    </div>
  );
}

const DROPDOWN_ITEM = "w-full text-left px-3 py-2.5 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2.5";

interface NewsCardProps {
  article: Article;
  isFirst?: boolean;
  isLast?: boolean;
  onMenuToggle?: (isOpen: boolean) => void;
}

export default function NewsCard({ article, isFirst, isLast, onMenuToggle }: NewsCardProps) {
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const copyWrapRef = useRef<HTMLDivElement>(null);
  const shareWrapRef = useRef<HTMLDivElement>(null);

  const displayTime = format(new Date(article.publishedAt), 'yyyy.MM.dd HH:mm', { locale: ko });
  const redirectUrl = `${window.location.origin}/api/r?u=${encodeURIComponent(article.url)}`;
  const kakaoShareText = `${article.title}\n${article.source} · ${displayTime}`;

  useEffect(() => {
    onMenuToggle?.(showCopyMenu || showShareMenu);
  }, [showCopyMenu, showShareMenu, onMenuToggle]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (copyWrapRef.current && !copyWrapRef.current.contains(event.target as Node)) {
        setShowCopyMenu(false);
      }
      if (shareWrapRef.current && !shareWrapRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = (mode: 'url' | 'both') => {
    navigator.clipboard.writeText(mode === 'url' ? article.url : `${article.title}\n${article.url}`);
    alert('복사되었습니다.');
    setShowCopyMenu(false);
  };

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const handleKakaoShare = () => {
    setShowShareMenu(false);
    const Kakao = (window as any).Kakao;
    if (!Kakao?.isInitialized()) { alert('카카오 SDK가 초기화되지 않았습니다.'); return; }
    const link = { mobileWebUrl: redirectUrl, webUrl: redirectUrl };
    const buttons = [{ title: '원문 보기', link }];

    // SDK calls window.open after async domain validation, so null.focus() errors
    // from popup blocking are uncatchable via try-catch. Suppress them globally.
    const suppressKakaoPopupError = (e: ErrorEvent) => {
      if (e.message?.includes('focus')) { e.preventDefault(); }
    };
    window.addEventListener('error', suppressKakaoPopupError, { once: true });

    try {
      Kakao.Share.sendDefault(
        article.imageUrl
          ? { objectType: 'feed', content: { title: article.title, description: `${article.source} · ${displayTime}`, imageUrl: article.imageUrl, link }, buttons }
          : { objectType: 'text', text: kakaoShareText, link, buttons }
      );
    } catch (e: unknown) {
      window.removeEventListener('error', suppressKakaoPopupError);
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('focus')) {
        alert('팝업이 차단되었습니다.\n\n주소창 오른쪽의 팝업 차단 아이콘을 클릭하여\n이 사이트의 팝업을 허용한 후 다시 시도해주세요.');
      }
    }
  };

  return (
    <article className={cn(
      "group relative bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-4 md:p-6 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/40",
      isFirst && "rounded-t-2xl",
      isLast && "rounded-b-2xl border-b-0"
    )}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-brand uppercase tracking-wider">{article.source}</span>
          <span className="w-0.5 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
          <span className="text-[10px] text-gray-400 font-medium">{displayTime}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-1.5 md:gap-4">
          <div className="flex-1">
            <h2 className="text-[16px] md:text-xl font-extrabold leading-[1.4] tracking-tight text-gray-900 dark:text-white mb-2 md:mb-3">
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-brand">
                {article.title}
              </a>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex ml-2 text-gray-300 hover:text-brand transition-colors shrink-0">
                <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </a>
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {article.tags.map(tagName => {
                const tagSpec = TAGS.find(t => t.name === tagName);
                const color = tagSpec ? CATEGORY_COLORS[tagSpec.category] : CATEGORY_COLORS[Category.ALL];
                return (
                  <span key={tagName} className={cn("px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-black border", color.bg, color.text, color.border)}>
                    {tagName}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Copy dropdown */}
            <div ref={copyWrapRef} className="relative">
              <button
                onClick={() => { setShowCopyMenu(v => !v); setShowShareMenu(false); }}
                className="p-2 text-gray-400 hover:text-brand bg-gray-50 dark:bg-gray-700 rounded-full transition-colors"
                title="복사"
              >
                <Link2 className="w-4 h-4" />
              </button>
              {showCopyMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[200] animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                  <p className="px-3 py-2 text-[11px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">링크 복사</p>
                  <div className="p-1">
                    <button onClick={() => handleCopy('url')} className={DROPDOWN_ITEM}>단순 링크 복사</button>
                    <button onClick={() => handleCopy('both')} className={DROPDOWN_ITEM}>제목 + 링크 복사</button>
                  </div>
                </div>
              )}
            </div>

            {/* Share dropdown */}
            <div ref={shareWrapRef} className="relative">
              <button
                onClick={() => { setShowShareMenu(v => !v); setShowCopyMenu(false); }}
                className="p-2 text-gray-400 hover:text-brand bg-gray-50 dark:bg-gray-700 rounded-full transition-colors"
                title="공유"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {showShareMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[200] animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                  <p className="px-3 py-2 text-[11px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">공유하기</p>
                  <div className="p-1">
                    {isMobile && (
                      <button onClick={handleKakaoShare} className={DROPDOWN_ITEM}>
                        <KakaoIcon />
                        카카오톡
                      </button>
                    )}
                    <a
                      href={`https://teams.microsoft.com/l/chat/0/0?users=&message=${encodeURIComponent(`${article.title}\n${article.url}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        navigator.clipboard.writeText(`${article.title}\n${article.url}`).catch(() => {});
                        setShowShareMenu(false);
                      }}
                      className={DROPDOWN_ITEM}
                    >
                      <TeamsIcon />
                      Teams
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
