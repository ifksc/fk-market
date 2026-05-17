'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import {
  createAdminBlogPost,
  updateAdminBlogPost,
  uploadAdminBlogCover,
  type AdminBlogInput,
  type AdminBlogPost,
} from '@/lib/admin';

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
        <button
          type="submit"
          form="blog-form"
          disabled={submitting}
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {submitting ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </header>

      <form id="blog-form" onSubmit={onSubmit} className="p-6 max-w-3xl space-y-4">
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
            <label className={labelCls}>Контент (Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={100000}
              className={`${areaCls} h-96 font-mono`}
            />
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
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt="" className="rounded-xl max-h-48 border border-slate-200 dark:border-slate-800" />
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
