'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import {
  createAdminBlogPost,
  updateAdminBlogPost,
  uploadAdminBlogCover,
  type AdminBlogInput,
  type AdminBlogPost,
} from '@/lib/admin';
import { Markdown } from '@/components/Markdown';

/** Список строк ↔ строка через запятую. */
function toList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export function BlogEditor({ initial }: { initial: AdminBlogPost | null }) {
  const router = useRouter();
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [metaDescription, setMetaDescription] = useState(initial?.meta_description ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(initial?.status ?? 'draft');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [relatedProducts, setRelatedProducts] = useState((initial?.related_products ?? []).join(', '));
  const [relatedPosts, setRelatedPosts] = useState((initial?.related_posts ?? []).join(', '));
  const [faq, setFaq] = useState(initial?.faq ?? []);
  const [coverImage, setCoverImage] = useState(initial?.cover_image ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Переключатель «Редактор / Превью» для поля контента.
  const [contentTab, setContentTab] = useState<'edit' | 'preview'>('edit');

  // --- Автосохранение черновика в localStorage ---
  const draftKey = initial ? `fk-blog-draft-${initial.id}` : 'fk-blog-draft-new';
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [restorable, setRestorable] = useState<string | null>(null);

  // Снимок исходных значений — с ним сравниваем, были ли правки.
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        title: initial?.title ?? '',
        slug: initial?.slug ?? '',
        excerpt: initial?.excerpt ?? '',
        metaDescription: initial?.meta_description ?? '',
        content: initial?.content ?? '',
        author: initial?.author ?? '',
        status: initial?.status ?? 'draft',
        tags: (initial?.tags ?? []).join(', '),
        relatedProducts: (initial?.related_products ?? []).join(', '),
        relatedPosts: (initial?.related_posts ?? []).join(', '),
        faq: initial?.faq ?? [],
      }),
    [initial],
  );

  // Текущий снимок формы.
  const snapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        slug,
        excerpt,
        metaDescription,
        content,
        author,
        status,
        tags,
        relatedProducts,
        relatedPosts,
        faq,
      }),
    [title, slug, excerpt, metaDescription, content, author, status, tags, relatedProducts, relatedPosts, faq],
  );

  // На монтировании: есть ли сохранённый черновик, отличный от исходных данных.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved && saved !== initialSnapshot) setRestorable(saved);
    } catch {
      /* localStorage недоступен */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автосейв (debounce 1с) — только когда форма реально изменена.
  useEffect(() => {
    if (snapshot === initialSnapshot) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, snapshot);
        setSavedAt(new Date());
      } catch {
        /* localStorage недоступен */
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [snapshot, initialSnapshot, draftKey]);

  const restoreDraft = () => {
    if (!restorable) return;
    try {
      const d = JSON.parse(restorable) as Record<string, unknown>;
      setTitle(typeof d.title === 'string' ? d.title : '');
      setSlug(typeof d.slug === 'string' ? d.slug : '');
      setExcerpt(typeof d.excerpt === 'string' ? d.excerpt : '');
      setMetaDescription(typeof d.metaDescription === 'string' ? d.metaDescription : '');
      setContent(typeof d.content === 'string' ? d.content : '');
      setAuthor(typeof d.author === 'string' ? d.author : '');
      setStatus(d.status === 'published' ? 'published' : 'draft');
      setTags(typeof d.tags === 'string' ? d.tags : '');
      setRelatedProducts(typeof d.relatedProducts === 'string' ? d.relatedProducts : '');
      setRelatedPosts(typeof d.relatedPosts === 'string' ? d.relatedPosts : '');
      setFaq(Array.isArray(d.faq) ? (d.faq as typeof faq) : []);
    } catch {
      /* битый черновик — игнорируем */
    }
    setRestorable(null);
  };

  const discardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setRestorable(null);
  };

  // --- Вставка картинки/ссылки в текст по позиции курсора ---
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (text: string) => {
    const ta = contentRef.current;
    if (!ta) {
      setContent((c) => c + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setContent(content.slice(0, start) + text + content.slice(end));
    // Возвращаем фокус и ставим курсор после вставленного фрагмента.
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  };

  const insertImage = () => {
    const url = window.prompt('URL картинки:')?.trim();
    if (!url) return;
    const alt = window.prompt('Описание картинки (alt):')?.trim() ?? '';
    insertAtCursor(`![${alt}](${url})`);
  };

  const insertLink = () => {
    const url = window.prompt('URL ссылки:')?.trim();
    if (!url) return;
    const text = window.prompt('Текст ссылки:')?.trim() || url;
    insertAtCursor(`[${text}](${url})`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Заголовок обязателен');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: AdminBlogInput = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt: excerpt.trim() || null,
        meta_description: metaDescription.trim() || null,
        content,
        author: author.trim() || null,
        status,
        tags: toList(tags),
        related_products: toList(relatedProducts),
        related_posts: toList(relatedPosts),
        faq: faq.filter((f) => f.question.trim() && f.answer.trim()),
      };
      if (isEdit && initial) {
        await updateAdminBlogPost(initial.id, payload);
        router.push('/admin/blog');
      } else {
        const created = await createAdminBlogPost(payload);
        // Переходим в режим редактирования — там доступна загрузка обложки.
        router.push(`/admin/blog/${created.id}`);
      }
      // Сохранение на сервере прошло — локальный черновик больше не нужен.
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
      setSubmitting(false);
    }
  };

  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initial) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await uploadAdminBlogCover(initial.id, file);
      setCoverImage(updated.cover_image ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить обложку');
    } finally {
      setUploading(false);
    }
  };

  const inputCls =
    'w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm';
  const areaCls =
    'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm resize-y';
  const labelCls = 'text-xs text-slate-500 mb-1 block';

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/admin/blog" className="text-slate-500 hover:text-brand-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-lg">{isEdit ? 'Статья блога' : 'Новая статья'}</h1>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-xs text-slate-400 hidden sm:inline">
              Черновик сохранён локально {savedAt.toLocaleTimeString('ru-RU')}
            </span>
          )}
          <button
            type="submit"
            form="blog-form"
            disabled={submitting}
            className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </header>

      <form id="blog-form" onSubmit={onSubmit} className="p-6 max-w-3xl space-y-4">
        {/* Восстановление несохранённого черновика */}
        {restorable && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm flex items-center justify-between gap-3">
            <span className="text-amber-800 dark:text-amber-300">
              Найден несохранённый черновик этой статьи.
            </span>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={restoreDraft}
                className="h-8 px-3 rounded-lg fk-grad-btn text-xs font-medium"
              >
                Восстановить
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="h-8 px-3 rounded-lg border border-amber-300 dark:border-amber-500/40 text-xs"
              >
                Удалить
              </button>
            </div>
          </div>
        )}

        {/* Основное */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className={labelCls}>Заголовок *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Slug (пусто — из заголовка)</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={200} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                className={inputCls}
              >
                <option value="draft">Черновик</option>
                <option value="published">Опубликовано</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Автор</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} className={inputCls} />
          </div>
        </div>

        {/* Контент */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <label className={labelCls}>Контент (Markdown или HTML)</label>
              <div className="flex items-center gap-1 text-xs">
                {contentTab === 'edit' && (
                  <>
                    <button
                      type="button"
                      onClick={insertImage}
                      className="px-2.5 py-1 rounded-md text-slate-500 hover:text-brand-600"
                    >
                      + Картинка
                    </button>
                    <button
                      type="button"
                      onClick={insertLink}
                      className="px-2.5 py-1 rounded-md text-slate-500 hover:text-brand-600"
                    >
                      + Ссылка
                    </button>
                    <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setContentTab('edit')}
                  className={`px-2.5 py-1 rounded-md ${
                    contentTab === 'edit' ? 'fk-grad-btn font-medium' : 'text-slate-500 hover:text-brand-600'
                  }`}
                >
                  Редактор
                </button>
                <button
                  type="button"
                  onClick={() => setContentTab('preview')}
                  className={`px-2.5 py-1 rounded-md ${
                    contentTab === 'preview' ? 'fk-grad-btn font-medium' : 'text-slate-500 hover:text-brand-600'
                  }`}
                >
                  Превью
                </button>
              </div>
            </div>
            {contentTab === 'edit' ? (
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={100000}
                className={`${areaCls} h-96 font-mono`}
              />
            ) : (
              <div className="min-h-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 overflow-auto">
                {content.trim() ? (
                  <Markdown>{content}</Markdown>
                ) : (
                  <p className="text-sm text-slate-400">Пусто — напишите контент во вкладке «Редактор».</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SEO + карточка */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className={labelCls}>Excerpt (краткое описание для карточки)</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={300}
              className={`${areaCls} h-20`}
            />
          </div>
          <div>
            <label className={labelCls}>Meta description (для поисковиков)</label>
            <input
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              maxLength={255}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Теги (через запятую)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Slug связанных товаров (через запятую)</label>
            <input
              value={relatedProducts}
              onChange={(e) => setRelatedProducts(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Slug связанных статей (через запятую)</label>
            <input value={relatedPosts} onChange={(e) => setRelatedPosts(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Обложка — только в режиме редактирования (нужен id статьи) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <label className={labelCls}>Обложка (1200×630)</label>
          {coverImage ? (
            <>
              {/* Кадр 1200×630 с object-cover — ровно так обложка
                  обрежется по центру на сайте. */}
              <div className="relative aspect-[1200/630] w-full max-w-md rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <p className="text-xs text-slate-400">
                Картинка обрезается по центру до 1200×630 — проверьте кадр выше.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400">Обложка не загружена</p>
          )}
          {isEdit ? (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onCoverChange}
              disabled={uploading}
              className="text-xs"
            />
          ) : (
            <p className="text-xs text-slate-400">
              Загрузка обложки станет доступна после первого сохранения статьи.
            </p>
          )}
          {uploading && <p className="text-xs text-slate-400">Загружаем…</p>}
        </div>

        {/* FAQ */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelCls}>Частые вопросы</label>
            <button
              type="button"
              onClick={() => setFaq([...faq, { question: '', answer: '' }])}
              className="text-xs text-brand-600 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить
            </button>
          </div>
          {faq.length === 0 && <p className="text-xs text-slate-400">Вопросов нет</p>}
          {faq.map((f, i) => (
            <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  value={f.question}
                  onChange={(e) => {
                    const next = [...faq];
                    next[i] = { ...next[i], question: e.target.value };
                    setFaq(next);
                  }}
                  placeholder="Вопрос"
                  maxLength={300}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setFaq(faq.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700 p-2.5 shrink-0"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={f.answer}
                onChange={(e) => {
                  const next = [...faq];
                  next[i] = { ...next[i], answer: e.target.value };
                  setFaq(next);
                }}
                placeholder="Ответ"
                maxLength={5000}
                className={`${areaCls} h-20`}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
