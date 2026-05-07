import { ExternalLink, Link2, Share2 } from 'lucide-react';
import { Article, Category } from '../types';
import { TAGS, CATEGORY_COLORS } from '../constants/tags';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState, useRef, useEffect } from 'react';

interface NewsCardProps {
  article: Article;
  isFirst?: boolean;
  isLast?: boolean;
  onMenuToggle?: (isOpen: boolean) => void;
}

export default function NewsCard({ article, isFirst, isLast, onMenuToggle }: NewsCardProps) {
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const displayTime = format(new Date(article.publishedAt), 'yyyy.MM.dd HH:mm', { locale: ko });
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const redirectUrl = `${window.location.origin}/api/r?u=${encodeURIComponent(article.url)}`;
  const kakaoShareText = `${article.title}\n${article.source} · ${displayTime}`;
  const KAKAO_APP_KEY = '0dbe9648057ad88c3d6de74a0451de72';

  useEffect(() => {
    onMenuToggle?.(showCopyMenu || showShareMenu);
  }, [showCopyMenu, showShareMenu, onMenuToggle]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        setShowCopyMenu(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const handleCopy = (mode: 'url' | 'both') => {
    const text = mode === 'url' ? article.url : `${article.title}\n${article.url}`;
    navigator.clipboard.writeText(text);
    alert('복사되었습니다.');
    setShowCopyMenu(false);
  };

  const handleKakaoPcShare = () => {
    const link = { mobile_web_url: redirectUrl, web_url: redirectUrl };
    const templateObject = JSON.stringify({
      object_type: 'text',
      text: kakaoShareText,
      link,
      buttons: [{ title: '원문 보기', link }],
    });
    const url = `https://sharer.kakao.com/talk/friends/picker/link?app_key=${KAKAO_APP_KEY}&link_ver=4.0&template_object=${encodeURIComponent(templateObject)}&ga=false`;
    // Must use window.open with popup dimensions so window.opener is set (required by sharer.kakao.com)
    window.open(url, 'kakaoShare', 'width=450,height=650,left=200,top=100');
    setShowShareMenu(false);
  };

  const handleKakaoShare = () => {
    // 모바일 전용: SDK가 KakaoTalk 앱 딥링크로 처리
    setShowShareMenu(false);
    const Kakao = (window as any).Kakao;
    if (!Kakao?.isInitialized()) { alert('카카오 SDK가 초기화되지 않았습니다.'); return; }
    const link = { mobileWebUrl: redirectUrl, webUrl: redirectUrl };
    const buttons = [{ title: '원문 보기', link }];
    Kakao.Share.sendDefault(
      article.imageUrl
        ? { objectType: 'feed', content: { title: article.title, description: `${article.source} · ${displayTime}`, imageUrl: article.imageUrl, link }, buttons }
        : { objectType: 'text', text: kakaoShareText, link, buttons }
    );
  };

  return (
    <article className={cn(
      "group relative bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-4 md:p-6 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/40",
      isFirst && "rounded-t-2xl",
      isLast && "rounded-b-2xl border-b-0"
    )}>
      <div className="flex flex-col gap-3">
        {/* Top Info: Source + Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-brand uppercase tracking-wider">{article.source}</span>
            <span className="w-0.5 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
            <span className="text-[10px] text-gray-400 font-medium">{displayTime}</span>
          </div>
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
                  <span 
                    key={tagName}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-black border",
                      color.bg, color.text, color.border
                    )}
                  >
                    {tagName}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Copy Menu Button */}
            <button 
              onClick={() => setShowCopyMenu(true)}
              className="p-2 text-gray-400 hover:text-brand bg-gray-50 dark:bg-gray-700 rounded-full transition-colors"
              title="복사"
            >
              <Link2 className="w-4 h-4" />
            </button>

            {/* Share Menu Button */}
            <button 
              onClick={() => setShowShareMenu(true)}
              className="p-2 text-gray-400 hover:text-brand bg-gray-50 dark:bg-gray-700 rounded-full transition-colors"
              title="공유"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Copy Modal Overlay */}
      {showCopyMenu && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            ref={copyMenuRef}
            className="relative z-10 w-full max-w-[280px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">링크 복사</h3>
            </div>
            <div className="p-2">
              <button 
                onClick={() => handleCopy('url')}
                className="w-full text-left px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors mb-1"
              >
                단순 링크 복사
              </button>
              <button 
                onClick={() => handleCopy('both')}
                className="w-full text-left px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                제목 + 링크 복사
              </button>
            </div>
            <button 
              onClick={() => setShowCopyMenu(false)}
              className="w-full py-4 text-[13px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border-t border-gray-100 dark:border-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Share Modal Overlay */}
      {showShareMenu && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            ref={shareMenuRef}
            className="relative z-10 w-full max-w-[280px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">기사 공유하기</h3>
            </div>
            <div className="p-2">
              {isMobile ? (
                <button
                  onClick={handleKakaoShare}
                  className="w-full text-left px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center gap-3 mb-1"
                >
                  <div className="w-6 h-6 shrink-0 shadow-sm overflow-hidden rounded-lg flex items-center justify-center bg-[#FEE500]">
                    <svg viewBox="0 0 48 48" className="w-full h-full p-1">
                      <path d="M24 10c-8.837 0-16 5.671-16 12.667 0 4.542 3.056 8.52 7.643 10.74l-1.94 7.108c-.12.438.39.814.767.565l8.36-5.514c.386.046.777.068 1.17.068 8.837 0 16-5.671 16-12.667S32.837 10 24 10z" fill="#3C1E1E"/>
                    </svg>
                  </div>
                  카카오톡 공유
                </button>
              ) : (
                <button
                  onClick={handleKakaoPcShare}
                  className="w-full text-left px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center gap-3 mb-1"
                >
                  <div className="w-6 h-6 shrink-0 shadow-sm overflow-hidden rounded-lg flex items-center justify-center bg-[#FEE500]">
                    <svg viewBox="0 0 48 48" className="w-full h-full p-1">
                      <path d="M24 10c-8.837 0-16 5.671-16 12.667 0 4.542 3.056 8.52 7.643 10.74l-1.94 7.108c-.12.438.39.814.767.565l8.36-5.514c.386.046.777.068 1.17.068 8.837 0 16-5.671 16-12.667S32.837 10 24 10z" fill="#3C1E1E"/>
                    </svg>
                  </div>
                  카카오톡 공유
                </button>
              )}
              <a
                href={`https://teams.microsoft.com/l/chat/0/0?users=&message=${encodeURIComponent(`${article.title}\n${article.url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowShareMenu(false)}
                className="w-full text-left px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center gap-3"
              >
                <div className="w-6 h-6 shrink-0 shadow-sm overflow-hidden rounded-lg flex items-center justify-center bg-[#4B53BC]">
                  <svg viewBox="0 0 24 24" className="w-full h-full p-1">
                    <path fill="#FFF" d="M11.5 6.5s.5-.5 1.5-.5 1.5.5 1.5.5V11s1 0 1.5.5 1 2 1 2 .5 1 .5 2v3h-5.5v-3s0-1 .5-2 1.5-3 1.5-3H11v-4h.5zM7 9h4v8H7V9z"/>
                  </svg>
                </div>
                Teams 공유
              </a>
            </div>
            <button 
              onClick={() => setShowShareMenu(false)}
              className="w-full py-4 text-[13px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border-t border-gray-100 dark:border-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
