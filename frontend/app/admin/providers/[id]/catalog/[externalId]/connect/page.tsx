'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  connectProviderProduct,
  getAdminCategories,
  getProviderCatalogItem,
  type AdminCategory,
  type ProviderCatalogItemDetail,
} from '@/lib/admin';

type FieldDef = { key: string; placeholder: string; values?: string[]; info?: string[] };

export default function ProviderConnectPage() {
  const params = useParams<{ id: string; externalId: string }>();
  const router = useRouter();
  const providerId = Number(params.id);
  const externalId = decodeURIComponent(params.externalId);

  const [item, setItem] = useState<ProviderCatalogItemDetail | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Форма
  const [name, setName] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [priceBase, setPriceBase] = useState<number>(0);
  const [markupPct, setMarkupPct] = useState<string>(''); // '' = по правилам
  const [fallback, setFallback] = useState<'manual' | 'none'>('manual');
  const [status, setStatus] = useState<'draft' | 'active'>('draft');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getProviderCatalogItem(providerId, externalId), getAdminCategories()])
      .then(([it, cats]) => {
        setItem(it);
        setCategories(cats);

        // Предзаполнение из raw_meta
        const meta = it.raw_meta as Record<string, unknown>;
        setName(String(meta.name_ru ?? ''));
        setShortDesc(String(meta.description_ru ?? '').slice(0, 500));
        const help = String(meta.help_description_ru ?? '');
        setDescription(
          [meta.description_ru, help && '\n\n' + help].filter(Boolean).join(''),
        );
        setPriceBase(Number(meta.price ?? 0));
        // Дефолт категории: подсказка из FK-синка, иначе первая в списке.
        const suggestedId = it.suggested_category?.id;
        if (suggestedId && cats.some((c) => c.id === suggestedId)) {
          setCategoryId(suggestedId);
        } else if (cats.length > 0) {
          setCategoryId(cats[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [providerId, externalId]);

  const requiredParams = (() => {
    if (!item) return [];
    const fields = (item.raw_meta?.fields as FieldDef[] | undefined) ?? [];
    return fields.map((f) => ({
      name: f.key,
      label: f.placeholder,
      type: f.values && f.values.length > 0 ? 'select' : 'string',
      required: true,
      ...(f.info && f.info.length > 0 ? { hint: f.info.join('. ') } : {}),
    }));
  })();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setSubmitting(true);
    try {
      const res = await connectProviderProduct(providerId, externalId, {
        category_id: categoryId,
        name,
        short_description: shortDesc || null,
        description: description || null,
        price_base: priceBase,
        markup_pct: markupPct === '' ? null : Number(markupPct),
        fulfillment_fallback: fallback,
        required_params: requiredParams.length > 0 ? requiredParams : null,
        status,
      });
      router.push(`/admin/products/${res.product_id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось подключить');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Загрузка…</div>;
  if (!item) return <div className="p-6 text-sm text-red-500">{error ?? 'Не найдено'}</div>;

  const meta = item.raw_meta as Record<string, unknown>;

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/providers/${providerId}/catalog`}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-bold text-lg">Подключить товар поставщика</h1>
        </div>
        <button
          form="connectForm"
          type="submit"
          disabled={submitting || !name || !categoryId}
          className="h-10 px-5 rounded-xl fk-grad-btn text-sm font-medium disabled:opacity-50"
        >
          {submitting ? 'Сохранение…' : 'Подключить'}
        </button>
      </header>

      <form id="connectForm" onSubmit={onSubmit} className="p-6 grid lg:grid-cols-[1fr_360px] gap-6 max-w-7xl">
        <section className="space-y-4">
          <Card title="Карточка товара">
            <Field label="Название">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              />
            </Field>
            <Field label="Категория в нашем каталоге">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Краткое описание (для карточки)">
              <input
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                maxLength={500}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              />
            </Field>
            <Field label="Полное описание">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
              />
            </Field>
          </Card>

          <Card title="Цена">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Закупка (price_base)">
                <input
                  type="number"
                  step="0.01"
                  value={priceBase}
                  onChange={(e) => setPriceBase(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                />
              </Field>
              <Field label="Наценка %, опционально">
                <input
                  type="number"
                  step="0.01"
                  value={markupPct}
                  onChange={(e) => setMarkupPct(e.target.value)}
                  placeholder="по правилам"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              Если оставить «Наценку» пустой — применяется правило по категории/глобальное.
            </p>
          </Card>

          {requiredParams.length > 0 && (
            <Card title="Параметры от покупателя (из FK fields)">
              <div className="text-xs text-slate-500 mb-3">
                Эти поля будут показаны покупателю при оформлении заказа.
              </div>
              <div className="space-y-2 text-sm">
                {requiredParams.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <code className="font-mono text-xs">{p.name}</code>
                    <span className="flex-1">{p.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-500/10">{p.type}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>

        <aside className="space-y-3">
          <Card title="Статус и поведение">
            <Field label="Статус">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              >
                <option value="draft">Черновик</option>
                <option value="active">Активный (виден на витрине)</option>
              </select>
            </Field>
            <Field label="Fallback при ошибке API">
              <select
                value={fallback}
                onChange={(e) => setFallback(e.target.value as 'manual' | 'none')}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              >
                <option value="manual">В ручную очередь</option>
                <option value="none">Нет (возврат денег)</option>
              </select>
            </Field>
          </Card>

          <Card title="Источник">
            <Row label="Поставщик" value={`#${providerId}`} />
            <Row label="External ID" value={<code className="font-mono">{externalId}</code>} />
            <Row label="Категория FK" value={String(meta.category_name ?? '—')} />
            <Row label="Currency" value={String(meta.currency ?? '—')} />
            {typeof meta.logo === 'string' && meta.logo ? (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meta.logo}
                  alt=""
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800"
                />
                <p className="text-xs text-slate-500 mt-1">Картинка из FK (URL)</p>
              </div>
            ) : null}
          </Card>
        </aside>
      </form>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="font-bold mb-4">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
