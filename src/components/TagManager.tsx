import React, { useState, KeyboardEvent } from 'react';
import { X, Plus, Pencil, Trash2, Check, GripVertical } from 'lucide-react';
import { useTags } from '../contexts/TagsContext';
import { createTag, updateTag, deleteTag, createCategory, updateCategory, deleteCategory, reorderTags, reorderCategories } from '../services/tagService';
import { cn } from '../lib/utils';

interface TagManagerProps {
  onClose: () => void;
}

type Tab = 'tags' | 'categories';

const INPUT_CLS = "px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-brand transition-colors";
const BTN_GHOST = "p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";

export default function TagManager({ onClose }: TagManagerProps) {
  const { tags, categories, getCategoryColor, mutateTags, mutateCategories } = useTags();
  const [tab, setTab] = useState<Tab>('tags');
  const [busy, setBusy] = useState(false);

  // --- Tag add form ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState(categories[0]?.name ?? '');
  const [addKeywords, setAddKeywords] = useState<string[]>([]);
  const [addKwInput, setAddKwInput] = useState('');

  // --- Tag edit state ---
  const [editTagId, setEditTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [editKwInput, setEditKwInput] = useState('');

  // --- Category add form ---
  const [showAddCatForm, setShowAddCatForm] = useState(false);
  const [addCatName, setAddCatName] = useState('');

  // --- Category edit state ---
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // --- Drag and drop ---
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragInsert, setDragInsert] = useState<{ catName: string; idx: number } | null>(null);

  function onTagDragStart(e: React.DragEvent, tagId: string) {
    e.dataTransfer.setData('tagId', tagId);
    e.dataTransfer.effectAllowed = 'move';
    setDragId(tagId);
  }

  function onTagDragOver(e: React.DragEvent<HTMLDivElement>, tagIdx: number, catName: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const insertIdx = e.clientY < rect.top + rect.height / 2 ? tagIdx : tagIdx + 1;
    setDragInsert(prev =>
      prev?.catName === catName && prev.idx === insertIdx ? prev : { catName, idx: insertIdx }
    );
  }

  function cleanDrag() { setDragId(null); setDragInsert(null); }

  async function onTagDrop(e: React.DragEvent, catName: string) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('tagId');
    const insert = dragInsert;
    cleanDrag();
    if (!sourceId || !insert || insert.catName !== catName) return;

    const sourceTag = tags.find(t => t.id === sourceId);
    if (!sourceTag || sourceTag.category !== catName) return;

    const catTags = tags.filter(t => t.category === catName);
    const sourceIdx = catTags.findIndex(t => t.id === sourceId);
    if (sourceIdx === -1) return;
    if (insert.idx === sourceIdx || insert.idx === sourceIdx + 1) return;

    const newCatTags = [...catTags];
    newCatTags.splice(sourceIdx, 1);
    const insertAt = insert.idx > sourceIdx ? insert.idx - 1 : insert.idx;
    newCatTags.splice(insertAt, 0, sourceTag);

    let ci = 0;
    const newTags = tags.map(t => t.category === catName ? newCatTags[ci++] : t);

    const prevTags = tags;
    mutateTags(() => newTags);
    try {
      await reorderTags(newTags);
    } catch (err: any) {
      mutateTags(() => prevTags);
      alert(err.message);
    }
  }

  // --- Category drag and drop ---
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragCatInsertIdx, setDragCatInsertIdx] = useState<number | null>(null);

  function onCatDragStart(e: React.DragEvent, catId: string) {
    e.dataTransfer.setData('catId', catId);
    e.dataTransfer.effectAllowed = 'move';
    setDragCatId(catId);
  }

  function onCatDragOver(e: React.DragEvent<HTMLDivElement>, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const insertIdx = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
    setDragCatInsertIdx(prev => prev === insertIdx ? prev : insertIdx);
  }

  function cleanCatDrag() { setDragCatId(null); setDragCatInsertIdx(null); }

  async function onCatDrop(e: React.DragEvent) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('catId');
    const insertIdx = dragCatInsertIdx;
    cleanCatDrag();
    if (!sourceId || insertIdx === null) return;

    const sourceIdx = categories.findIndex(c => c.id === sourceId);
    if (sourceIdx === -1) return;
    if (insertIdx === sourceIdx || insertIdx === sourceIdx + 1) return;

    const newCats = [...categories];
    const [removed] = newCats.splice(sourceIdx, 1);
    const insertAt = insertIdx > sourceIdx ? insertIdx - 1 : insertIdx;
    newCats.splice(insertAt, 0, removed);

    const prevCats = categories;
    mutateCategories(() => newCats);
    try {
      await reorderCategories(newCats);
    } catch (err: any) {
      mutateCategories(() => prevCats);
      alert(err.message);
    }
  }

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    try { return await fn(); } catch (e: any) { alert(e.message); return undefined; } finally { setBusy(false); }
  }

  // Tag add
  function pushAddKw() {
    const kw = addKwInput.trim();
    if (kw && !addKeywords.includes(kw)) setAddKeywords(prev => [...prev, kw]);
    setAddKwInput('');
  }
  function onAddKwKey(e: KeyboardEvent<HTMLInputElement>) { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); pushAddKw(); } }

  async function handleAddTag() {
    if (!addName.trim() || !addCategory) return;
    const created = await run(() => createTag({ name: addName.trim(), category: addCategory, keywords: addKeywords }));
    if (created) {
      mutateTags(prev => [...prev, created]);
      setAddName(''); setAddKeywords([]); setAddKwInput(''); setShowAddForm(false);
    }
  }

  // Tag edit
  function startEditTag(id: string) {
    const t = tags.find(t => t.id === id);
    if (!t) return;
    setEditTagId(id); setEditName(t.name); setEditCategory(t.category); setEditKeywords([...t.keywords]); setEditKwInput('');
  }
  function pushEditKw() {
    const kw = editKwInput.trim();
    if (kw && !editKeywords.includes(kw)) setEditKeywords(prev => [...prev, kw]);
    setEditKwInput('');
  }
  function onEditKwKey(e: KeyboardEvent<HTMLInputElement>) { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); pushEditKw(); } }

  async function handleSaveTag() {
    if (!editTagId) return;
    const updated = await run(() => updateTag(editTagId, { name: editName.trim(), category: editCategory, keywords: editKeywords }));
    if (updated) {
      mutateTags(prev => prev.map(t => t.id === editTagId ? updated : t));
      setEditTagId(null);
    }
  }

  async function handleDeleteTag(id: string) {
    if (!confirm('이 태그를 삭제할까요?')) return;
    setBusy(true);
    try { await deleteTag(id); mutateTags(prev => prev.filter(t => t.id !== id)); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  // Category add
  async function handleAddCategory() {
    if (!addCatName.trim()) return;
    const created = await run(() => createCategory(addCatName.trim()));
    if (created) {
      mutateCategories(prev => [...prev, created]);
      setAddCatName(''); setShowAddCatForm(false);
    }
  }

  // Category edit
  function startEditCat(id: string) {
    const c = categories.find(c => c.id === id);
    if (!c) return;
    setEditCatId(id); setEditCatName(c.name);
  }
  async function handleSaveCat() {
    if (!editCatId) return;
    const updated = await run(() => updateCategory(editCatId, editCatName.trim()));
    if (updated) {
      mutateCategories(prev => prev.map(c => c.id === editCatId ? updated : c));
      mutateTags(prev => prev.map(t => {
        const old = categories.find(c => c.id === editCatId);
        return old && t.category === old.name ? { ...t, category: updated.name } : t;
      }));
      setEditCatId(null);
    }
  }
  async function handleDeleteCat(id: string) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    if (!confirm(`"${cat.name}" 카테고리를 삭제할까요?\n이 카테고리의 태그는 '미분류'로 이동됩니다.`)) return;
    setBusy(true);
    try {
      await deleteCategory(id);
      mutateCategories(prev => prev.filter(c => c.id !== id));
      mutateTags(prev => prev.map(t => t.category === cat.name ? { ...t, category: '미분류' } : t));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Tag list grouped by category
  const allCategoryNames = [...categories.map(c => c.name), '미분류'];
  const hasUnclassified = tags.some(t => !categories.find(c => c.name === t.category));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl flex flex-col max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-base font-black text-gray-900 dark:text-white">태그 관리</h2>
          <button onClick={onClose} className={BTN_GHOST}><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 px-6">
          {(['tags', 'categories'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-1 py-3 mr-6 text-[13px] font-extrabold transition-all relative",
                tab === t
                  ? "text-brand after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-full"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              )}>
              {t === 'tags' ? '태그 관리' : '카테고리 관리'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'tags' ? (
            <>
              {/* Add tag toggle button / inline form */}
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-brand/40 text-brand text-sm font-bold hover:bg-brand-light/50 transition-colors"
                >
                  <Plus className="w-4 h-4" />태그 추가
                </button>
              ) : (
                <div className="border border-brand/25 bg-brand-light/20 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-brand uppercase tracking-wider">새 태그 추가</p>
                    <button
                      onClick={() => { setShowAddForm(false); setAddName(''); setAddKeywords([]); setAddKwInput(''); }}
                      className={BTN_GHOST}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input value={addName} onChange={e => setAddName(e.target.value)}
                      placeholder="태그명" className={cn(INPUT_CLS, "flex-1")} autoFocus />
                    <select value={addCategory} onChange={e => setAddCategory(e.target.value)} className={INPUT_CLS}>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {addKeywords.map(kw => (
                      <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-700 dark:text-gray-200">
                        {kw}
                        <button onClick={() => setAddKeywords(p => p.filter(k => k !== kw))} className="hover:text-red-500"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                    <input value={addKwInput} onChange={e => setAddKwInput(e.target.value)} onKeyDown={onAddKwKey} onBlur={pushAddKw}
                      placeholder="키워드 입력 후 Enter" className="px-2 py-0.5 text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded bg-transparent outline-none focus:border-brand min-w-[120px]" />
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleAddTag} disabled={busy || !addName.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors">
                      <Plus className="w-4 h-4" />추가
                    </button>
                  </div>
                </div>
              )}

              {/* Tag list by category */}
              {allCategoryNames.filter(name => name !== '미분류' || hasUnclassified).map(catName => {
                const catTags = tags.filter(t => catName === '미분류' ? !categories.find(c => c.name === t.category) : t.category === catName);
                if (catTags.length === 0) return null;
                const color = getCategoryColor(catName);
                return (
                  <div key={catName}>
                    <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-black border mb-2", color.bg, color.text, color.border)}>
                      {catName}
                    </span>
                    <div
                      className="space-y-1.5"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => onTagDrop(e, catName)}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragInsert(null); }}
                    >
                      {catTags.map((tag, idx) => (
                        <div key={tag.id}>
                          {dragInsert?.catName === catName && dragInsert.idx === idx && (
                            <div className="flex items-center gap-0 my-1 pointer-events-none">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                              <div className="flex-1 h-0.5 bg-brand" />
                              <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                            </div>
                          )}
                          {editTagId === tag.id ? (
                            <div className="p-3 rounded-xl border border-brand/30 bg-brand-light/30 dark:bg-gray-800 space-y-2">
                              <div className="flex gap-2">
                                <input value={editName} onChange={e => setEditName(e.target.value)}
                                  placeholder="태그명" className={cn(INPUT_CLS, "flex-1")} />
                                <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className={INPUT_CLS}>
                                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                              </div>
                              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                                {editKeywords.map(kw => (
                                  <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-700 dark:text-gray-200">
                                    {kw}
                                    <button onClick={() => setEditKeywords(p => p.filter(k => k !== kw))} className="hover:text-red-500"><X className="w-2.5 h-2.5" /></button>
                                  </span>
                                ))}
                                <input value={editKwInput} onChange={e => setEditKwInput(e.target.value)} onKeyDown={onEditKwKey} onBlur={pushEditKw}
                                  placeholder="키워드 입력 후 Enter" className="px-2 py-0.5 text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded bg-transparent outline-none focus:border-brand min-w-[120px]" />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditTagId(null)} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">취소</button>
                                <button onClick={handleSaveTag} disabled={busy} className="px-4 py-1.5 text-xs font-bold bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">저장</button>
                              </div>
                            </div>
                          ) : (
                            <div
                              draggable
                              onDragStart={e => onTagDragStart(e, tag.id)}
                              onDragOver={e => onTagDragOver(e, idx, catName)}
                              onDragEnd={cleanDrag}
                              className={cn(
                                "flex items-start gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 group transition-opacity",
                                dragId === tag.id && "opacity-50"
                              )}
                            >
                              <GripVertical className="w-4 h-4 shrink-0 mt-0.5 text-gray-300 dark:text-gray-600 cursor-grab md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                              <span className="text-sm font-bold text-gray-900 dark:text-white shrink-0 w-28 truncate">{tag.name}</span>
                              <div className="flex-1 flex flex-wrap gap-1">
                                {tag.keywords.map(kw => (
                                  <span key={kw} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-300">{kw}</span>
                                ))}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => startEditTag(tag.id)} className={BTN_GHOST}><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDeleteTag(tag.id)} className={cn(BTN_GHOST, "hover:text-red-500")}><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {dragInsert?.catName === catName && dragInsert.idx === catTags.length && (
                        <div className="flex items-center gap-0 my-1 pointer-events-none">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                          <div className="flex-1 h-0.5 bg-brand" />
                          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {/* Add category toggle button / inline form */}
              {!showAddCatForm ? (
                <button
                  onClick={() => setShowAddCatForm(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-brand/40 text-brand text-sm font-bold hover:bg-brand-light/50 transition-colors"
                >
                  <Plus className="w-4 h-4" />카테고리 추가
                </button>
              ) : (
                <div className="border border-brand/25 bg-brand-light/20 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-brand uppercase tracking-wider">새 카테고리 추가</p>
                    <button
                      onClick={() => { setShowAddCatForm(false); setAddCatName(''); }}
                      className={BTN_GHOST}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input value={addCatName} onChange={e => setAddCatName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                      placeholder="카테고리명" className={cn(INPUT_CLS, "flex-1")} autoFocus />
                    <button onClick={handleAddCategory} disabled={busy || !addCatName.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors">
                      <Plus className="w-4 h-4" />추가
                    </button>
                  </div>
                </div>
              )}

              {/* Category list */}
              <div
                className="space-y-2"
                onDragOver={e => e.preventDefault()}
                onDrop={onCatDrop}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) cleanCatDrag(); }}
              >
                {categories.map((cat, idx) => {
                  const tagCount = tags.filter(t => t.category === cat.name).length;
                  return (
                    <div key={cat.id}>
                      {dragCatInsertIdx === idx && (
                        <div className="flex items-center gap-0 my-1 pointer-events-none">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                          <div className="flex-1 h-0.5 bg-brand" />
                          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                        </div>
                      )}
                      <div
                        draggable
                        onDragStart={e => onCatDragStart(e, cat.id)}
                        onDragOver={e => onCatDragOver(e, idx)}
                        onDragEnd={cleanCatDrag}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 group transition-opacity",
                          dragCatId === cat.id && "opacity-50"
                        )}
                      >
                        <GripVertical className="w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600 cursor-grab md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-black border shrink-0", cat.color.bg, cat.color.text, cat.color.border)}>
                          {cat.name}
                        </span>
                        {editCatId === cat.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSaveCat()}
                              className={cn(INPUT_CLS, "flex-1 h-8 text-xs")} autoFocus />
                            <button onClick={handleSaveCat} disabled={busy} className="p-1.5 text-brand hover:bg-brand/10 rounded-lg"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditCatId(null)} className={BTN_GHOST}><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-500 dark:text-gray-400">{tagCount}개 태그</span>
                            <div className="flex gap-1">
                              <button onClick={() => startEditCat(cat.id)} className={BTN_GHOST} title="이름 변경"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteCat(cat.id)} className={cn(BTN_GHOST, "hover:text-red-500")} title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {dragCatInsertIdx === categories.length && (
                  <div className="flex items-center gap-0 my-1 pointer-events-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <div className="flex-1 h-0.5 bg-brand" />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
