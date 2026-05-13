import { useState, useEffect, type ReactNode } from 'react';
import { Sparkles, RefreshCw, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { Article } from '../types';
import { format } from 'date-fns';

interface Props {
  articles: Article[];
  date: Date;
}

type SubSection = { title: string; lines: string[] };
type Section = { title: string; lines: string[]; subsections: SubSection[] };

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let currentSub: SubSection | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      if (current && currentSub) {
        current.subsections.push(currentSub);
        currentSub = null;
      }
      if (current) sections.push(current);
      current = { title: line.slice(3).trim(), lines: [], subsections: [] };
    } else if (line.startsWith('### ') && current) {
      if (currentSub) current.subsections.push(currentSub);
      currentSub = { title: line.slice(4).trim(), lines: [] };
    } else if (currentSub) {
      currentSub.lines.push(line);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current && currentSub) current.subsections.push(currentSub);
  if (current) sections.push(current);
  return sections;
}

function extractBullets(lines: string[]): string[] {
  return lines
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .filter(l => /^[-•*]\s+/.test(l) || /^\d+\.\s/.test(l))
    .map(l => l.replace(/^[-•*]\s+|^\d+\.\s*/, '').trim());
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>
      : part
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand mb-2.5">
      {title}
    </p>
  );
}

function SummarySection({ lines }: { lines: string[] }) {
  const content = lines.filter(l => l.trim()).join(' ');
  if (!content) return null;
  return (
    <p className="text-[15px] leading-[1.8] font-semibold text-gray-900 dark:text-white">
      {content}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2.5 items-start">
          <span className="shrink-0 mt-[9px] w-[5px] h-[5px] rounded-full bg-brand" />
          <p className="text-[14px] leading-[1.7] text-gray-700 dark:text-gray-300">
            {renderInline(item)}
          </p>
        </div>
      ))}
    </div>
  );
}

function FlowSection({ subsections, lines }: { subsections: SubSection[]; lines: string[] }) {
  if (subsections.length > 0) {
    return (
      <div className="space-y-4">
        {subsections.map((sub, i) => {
          const items = extractBullets(sub.lines);
          if (!items.length) return null;
          return (
            <div key={i}>
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2">
                {sub.title}
              </p>
              <BulletList items={items} />
            </div>
          );
        })}
      </div>
    );
  }

  const numbered = lines.filter(l => /^\d+\.\s/.test(l));
  if (!numbered.length) return null;
  return (
    <div className="space-y-3.5">
      {numbered.map((line, i) => (
        <div key={i} className="flex gap-3 items-start">
          <span className="shrink-0 w-[22px] h-[22px] rounded-full bg-brand/10 dark:bg-brand/20 text-brand text-[10px] font-black flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <p className="text-[14px] leading-[1.7] text-gray-700 dark:text-gray-300">
            {renderInline(line.replace(/^\d+\.\s*/, ''))}
          </p>
        </div>
      ))}
    </div>
  );
}

function CluesSection({ lines }: { lines: string[] }) {
  const items = extractBullets(lines);
  if (!items.length) return null;
  return <BulletList items={items} />;
}

function MustReadSection({ lines }: { lines: string[] }) {
  const items = lines.filter(l => /^\d+\.\s/.test(l));
  if (!items.length) return null;
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
      {items.map((line, i) => {
        const content = line.replace(/^\d+\.\s*/, '');
        const dashIdx = content.lastIndexOf(' — ');
        const titleRaw = dashIdx !== -1 ? content.slice(0, dashIdx) : content;
        const source = dashIdx !== -1 ? content.slice(dashIdx + 3).trim() : '';
        const title = titleRaw.replace(/\*\*/g, '').trim();
        return (
          <div key={i} className="py-3 first:pt-0 last:pb-0">
            {source && (
              <p className="text-[10px] font-black text-brand uppercase tracking-widest mb-1">
                {source}
              </p>
            )}
            <p className="text-[15px] font-bold leading-snug text-gray-900 dark:text-white">
              {title}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function BriefingContent({ text }: { text: string }) {
  const sections = parseSections(text);
  if (!sections.length) return null;

  return (
    <div>
      {sections.map((section, i) => {
        const isSummary = section.title.includes('요약');
        const isFlow = section.title.includes('흐름');
        const isClues = section.title.includes('단서') || section.title.includes('지켜볼');
        const isMustRead = section.title.includes('놓치지');

        return (
          <div
            key={i}
            className={i > 0 ? 'mt-5 pt-5 border-t border-gray-100 dark:border-gray-700' : ''}
          >
            <SectionLabel title={section.title} />
            {isSummary && <SummarySection lines={section.lines} />}
            {isFlow && <FlowSection subsections={section.subsections} lines={section.lines} />}
            {isClues && <CluesSection lines={section.lines} />}
            {isMustRead && <MustReadSection lines={section.lines} />}
            {!isSummary && !isFlow && !isClues && !isMustRead && (
              <div className="space-y-2">
                {section.lines.filter(l => l.trim()).map((line, j) => (
                  <p key={j} className="text-[14px] leading-[1.7] text-gray-700 dark:text-gray-300">
                    {renderInline(line)}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
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
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
          <span className="font-bold text-[15px] text-gray-900 dark:text-white">AI 브리핑</span>
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
        <div className="border-t border-gray-50 dark:border-gray-700 px-5 py-5">
          {!showContent ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-[13px] text-gray-400 text-center">
                오늘의 AI 뉴스를 한눈에 파악하세요
              </p>
              <button
                onClick={generate}
                disabled={!articles.length}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-[13px] font-bold rounded-lg transition-all disabled:opacity-40 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                브리핑 생성
              </button>
              {!articles.length && (
                <p className="text-[11px] text-gray-400">기사를 먼저 조회해주세요</p>
              )}
            </div>
          ) : (
            <div>
              {isGenerating && !text ? (
                <div className="flex items-center gap-2.5 py-2">
                  <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
                  <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
                    AI가 브리핑을 생성하고 있습니다...
                  </span>
                </div>
              ) : (
                <>
                  <BriefingContent text={text} />
                  {isGenerating && (
                    <span className="inline-block w-[2px] h-[1em] bg-brand animate-pulse align-middle ml-0.5" />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
