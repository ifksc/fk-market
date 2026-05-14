'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  createAdminProduct,
  getAdminCategories,
  type AdminCategory,
  type AdminProductInput,
} from '@/lib/admin';

export default function AdminProductNewPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<AdminProductInput>({
    name: '',
    short_description: '',
    description: '',
    category_id: 0,
    price_base: 0,
    markup_pct: null,
    fulfillment_mode: 'stock',
    fulfillment_fallback: 'none',
    status: 'draft',
  });

  useEffect(() => {
    getAdminCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0 && !data.category_id) {
        setData((d) => ({ ...d, category_id: cats[0].id }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upd = <K extends keyof AdminProductInput>(key: K, value: AdminProductInput[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createAdminProduct(data);
      router.push(`/admin/products/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать');
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-bold text-lg">Новый товар</h1>
        </div>
        <button
          form="newProductForm"
          type="submit"
          disabled={submitting}
          className="h-10 px-5 rounded-xl fk-grad-btn text-sm font-medium disabled:opacity-50"
        >
          {submitting ? 'Создание…' : 'Создать черновик'}
        </button>
      </header>

      <form id="newProductForm" onSubmit={onSubmit} className="p-6 max-w-3xl space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Название *</span>
            <input
              required
              value={data.name ?? ''}
              onChange={(e) => upd('name', e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              placeholder="Например, ChatGPT Plus · 1 месяц"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Категория *</span>
            <select
              required
              value={data.category_id ?? 0}
              onChange={(e) => upd('category_id', Number(e.target.value))}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Краткое описание</span>
            <input
              value={data.short_description ?? ''}
              onChange={(e) => upd('short_description', e.target.value)}
              maxLength={500}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
            />
          </label>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500 mb-1 block">Базовая цена (₽) *</span>
              <input
                type="number"
                step="0.01"
                required
                value={data.price_base ?? 0}
                onChange={(e) => upd('price_base', Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 mb-1 block">Наценка % (опционально)</span>
              <input
                type="number"
                step="0.01"
                value={data.markup_pct ?? ''}
                onChange={(e) => upd('markup_pct', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="по правилам"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Режим выдачи</span>
            <select
              value={data.fulfillment_mode ?? 'stock'}
              onChange={(e) => upd('fulfillment_mode', e.target.value as 'stock' | 'api' | 'manual')}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
            >
              <option value="stock">Склад (автовыдача)</option>
              <option value="api">API поставщика</option>
              <option value="manual">Ручная (через очередь)</option>
            </select>
          </label>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          После создания товар попадёт в статус <b>«Черновик»</b>. Чтобы он появился на витрине — переведи в <b>«Активный»</b> и
          (для режима «Склад») загрузи ключи.
        </p>
      </form>
    </div>
  );
}
