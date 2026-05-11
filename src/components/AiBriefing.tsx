import { useState, useEffect, type ReactNode } from 'react';
import { Sparkles, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { Article } from '../types';
import { format } from 'date-fns';

interface Props {
  articles: Article[];
  date: Date;
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>
      : part
  );
}

function BriefingContent({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <p key={i} className="text-brand font-bold text-[12px] uppercase tracking-wide mt-3 mb-0.5 first:mt-0">
              {line.slice(3)}
            </p>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <p key={i} className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
              {renderInline(line)}
            </p>
          );
        }
        if (line.trim()) {
          return (
            <p key={i} className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
              {renderInline(line)}
            </p>
          );
        }
        return <div key={i} className="h-0.5" />;
      })}
    </div>
  );
}

export default function AiBriefing({ articles, date }: Props) {
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    setText('');
    setHasGenerated(false);
    setIsGenerating(false);
  }, [dateStr]);

  const generate = async () => {
    if (!articles.length || isGenerating) return;
    setIsGenerating(true);
    setHasGenerated(false);
    setText('');
    setIsCollapsed(false);

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: articles.map(a => ({ title: a.title, source: a.source })),
          date: dateStr,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setText(prev => prev + decoder.decode(value, { stream: true }));
      }
      setHasGenerated(true);
    } catch {
      setText('브리핑 생성에 실패했습니다. 다시 시도해주세요.');
      setHasGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const showContent = hasGenerated || isGenerating;

  return (
    <div className="mb-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
          <span className="font-bold text-[13px] text-gray-900 dark:text-white">AI 브리핑</span>
          {articles.length > 0 && (
            <span className="text-[11px] text-gray-400 font-medium">{articles.length}건</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showContent && (
            <button
              onClick={generate}
              disabled={isGenerating || !articles.length}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
              재생성
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(v => !v)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            {isCollapsed
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronUp className="w-4 h-4" />
            }
          </button>
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="border-t border-gray-50 dark:border-gray-700 px-4 py-3">
          {!showContent ? (
            <div className="flex flex-col items-center gap-2.5 py-3">
              <p className="text-[12px] text-gray-400 text-center">
                오늘의 AI 뉴스를 한눈에 파악하세요
              </p>
              <button
                onClick={generate}
                disabled={!articles.length}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-[12px] font-bold rounded-lg transition-all disabled:opacity-40 shadow-sm"
              >
                <Sparkles className="w-3 h-3" />
                브리핑 생성
              </button>
              {!articles.length && (
                <p className="text-[11px] text-gray-400">기사를 먼저 조회해주세요</p>
              )}
            </div>
          ) : (
            <div className="min-h-[2rem]">
              {text && <BriefingContent text={text} />}
              {isGenerating && (
                <span className="inline-block w-0.5 h-4 bg-brand animate-pulse align-middle ml-0.5" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
