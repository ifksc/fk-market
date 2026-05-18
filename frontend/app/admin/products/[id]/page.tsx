'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Boxes, RefreshCw, Trash2 } from 'lucide-react';
import {
  archiveAdminProduct,
  deleteAdminProductImage,
  getAdminCategories,
  getAdminProduct,
  makeAdminProductImagePrimary,
  resyncAdminProduct,
  updateAdminProduct,
  uploadAdminProductImage,
  type AdminCategory,
  type AdminProductDetail,
  type AdminProductInput,
} from '@/lib/admin';
import { ProductFaqBlock } from '@/components/admin/ProductFaqBlock';

export default function AdminProductDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    Promise.all([getAdminProduct(id), getAdminCategories()])
      .then(([p, cats]) => {
        setProduct(p);
        setCategories(cats);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageWrap><div className="p-6 text-sm text-slate-500">Загрузка…</div></PageWrap>;
  if (!product || error) return <PageWrap><div className="p-6 text-sm text-red-500">{error ?? 'Не найдено'}</div></PageWrap>;

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      const data: AdminProductInput = {
        name: product.name,
        slug: product.slug,
        category_id: product.category_id,
        short_description: product.short_description,
        description: product.description,
        price_base: product.price_base,
        markup_pct: product.markup_pct,
        price_old: product.price_old,
        fulfillment_mode: product.fulfillment_mode,
        fulfillment_fallback: product.fulfillment_fallback,
        status: product.status,
      };
      const updated = await updateAdminProduct(product.id, data);
      setProduct(updated);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Перевести товар в архив? Он перестанет показываться на витрине.')) return;
    try {
      await archiveAdminProduct(product.id);
      router.push('/admin/products');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось архивировать');
    }
  };

  const handleResync = async () => {
    if (!product) return;
    if (
      !confirm(
        'Обновить товар из данных поставщика? Будет повторно синхронизирована '
          + 'категория этого товара. Несохранённые изменения формы потеряются.',
      )
    ) {
      return;
    }
    setResyncing(true);
    setError(null);
    try {
      await resyncAdminProduct(product.id);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить из поставщика');
      setResyncing(false);
    }
  };

  const update = <K extends keyof AdminProductDetail>(key: K, value: AdminProductDetail[K]) => {
    setProduct((p) => (p ? { ...p, [key]: value } : p));
  };

  return (
    <PageWrap>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/products"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-lg line-clamp-1">{product.name}</h1>
            <div className="text-xs text-slate-500 font-mono">FK-{product.id.toString().padStart(5, '0')} · {product.slug}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-emerald-600">сохранено в {savedAt.toLocaleTimeString('ru')}</span>}
          <Link
            href={`/admin/products/${product.id}/stock`}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm flex items-center gap-2"
          >
            <Boxes className="w-4 h-4" />
            Склад ({product.stock_available} / {product.stock_total})
          </Link>
          {product.fulfillment_mode === 'api' && (
            <button
              onClick={handleResync}
              disabled={resyncing}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm flex items-center gap-1 disabled:opacity-50"
              title="Повторно синхронизировать товар из каталога поставщика"
            >
              <RefreshCw className="w-4 h-4" />
              {resyncing ? 'Обновляем…' : 'Обновить из поставщика'}
            </button>
          )}
          <button
            onClick={handleArchive}
            className="h-10 px-3 rounded-xl border border-red-300 dark:border-red-700 text-sm text-red-600 flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Архив
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-5 rounded-xl fk-grad-btn text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </header>

      <div className="p-6 grid lg:grid-cols-[1fr_360px] gap-6 max-w-7xl">
        {/* Основная форма */}
        <section className="space-y-4">
          <Card title="Основное">
            <Field label="Название">
              <input
                value={product.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              />
            </Field>
            <Field label="Slug (URL)">
              <input
                value={product.slug}
                onChange={(e) => update('slug', e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-sm"
              />
            </Field>
            <Field label="Категория">
              <select
                value={product.category_id}
                onChange={(e) => update('category_id', Number(e.target.value))}
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
                value={product.short_description ?? ''}
                onChange={(e) => update('short_description', e.target.value)}
                maxLength={500}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              />
            </Field>
            <Field label="Полное описание">
              <textarea
                value={product.description ?? ''}
                onChange={(e) => update('description', e.target.value)}
                rows={6}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
              />
            </Field>
          </Card>

          <Card title="Цена и наценка">
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Базовая цена (₽)">
                <input
                  type="number"
                  step="0.01"
                  value={product.price_base}
                  onChange={(e) => update('price_base', Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                />
              </Field>
              <Field label="Наценка % (если null — берётся из правил)">
                <input
                  type="number"
                  step="0.01"
                  value={product.markup_pct ?? ''}
                  placeholder="по правилам"
                  onChange={(e) => update('markup_pct', e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                />
              </Field>
              <Field label="Старая цена (для скидки)">
                <input
                  type="number"
                  step="0.01"
                  value={product.price_old ?? ''}
                  onChange={(e) => update('price_old', e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                />
              </Field>
            </div>
            <div className="mt-3 text-sm text-slate-500">
              Текущая витринная цена: <b className="text-slate-900 dark:text-white">{product.price_final.toLocaleString('ru')} ₽</b>{' '}
              (пересчитается при сохранении)
            </div>
          </Card>

          <Card title="Выдача">
            <Field label="Режим">
              <select
                value={product.fulfillment_mode}
                onChange={(e) => update('fulfillment_mode', e.target.value as 'stock' | 'api' | 'manual')}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              >
                <option value="stock">Склад (автовыдача из ключей)</option>
                <option value="api">API поставщика</option>
                <option value="manual">Ручная (через очередь)</option>
              </select>
            </Field>
            <Field label="Fallback при ошибке (для api)">
              <select
                value={product.fulfillment_fallback}
                onChange={(e) => update('fulfillment_fallback', e.target.value as 'manual' | 'none')}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              >
                <option value="none">Нет (возврат денег)</option>
                <option value="manual">В ручную очередь</option>
              </select>
            </Field>
          </Card>

          <ProductFaqBlock productId={product.id} />
        </section>

        {/* Боковая панель */}
        <aside className="space-y-4">
          <Card title="Статус и публикация">
            <Field label="Статус">
              <select
                value={product.status}
                onChange={(e) => update('status', e.target.value as 'draft' | 'active' | 'archived')}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              >
                <option value="draft">Черновик</option>
                <option value="active">Активный (виден на витрине)</option>
                <option value="archived">Архив</option>
              </select>
            </Field>
          </Card>

          <Card title="Склад">
            <div className="space-y-2 text-sm">
              <Row label="Всего ключей" value={product.stock_total.toString()} />
              <Row
                label="В наличии"
                value={
                  <span
                    className={
                      product.stock_available === 0
                        ? 'text-red-500 font-semibold'
                        : product.stock_available <= 5
                        ? 'text-yellow-600 font-semibold'
                        : 'text-emerald-600 font-semibold'
                    }
                  >
                    {product.stock_available}
                  </span>
                }
              />
              <Row label="Продано" value={product.stock_sold.toString()} />
            </div>
            <Link
              href={`/admin/products/${product.id}/stock`}
              className="mt-4 block text-center h-10 rounded-xl fk-grad-btn text-sm font-medium pt-2.5"
            >
              Управлять складом →
            </Link>
          </Card>

          <ImagesCard
            product={product}
            onChange={(images) => setProduct((p) => (p ? { ...p, images } : p))}
          />

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </aside>
      </div>
    </PageWrap>
  );
}

// ---------- Картинки ----------
function ImagesCard({
  product,
  onChange,
}: {
  product: AdminProductDetail;
  onChange: (images: AdminProductDetail['images']) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const created = await uploadAdminProductImage(product.id, file);
      onChange([...product.images, created]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось загрузить');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const setPrimary = async (imageId: number) => {
    try {
      await makeAdminProductImagePrimary(product.id, imageId);
      onChange(product.images.map((img) => ({ ...img, is_primary: img.id === imageId })));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const remove = async (imageId: number) => {
    if (!confirm('Удалить картинку?')) return;
    try {
      await deleteAdminProductImage(product.id, imageId);
      onChange(product.images.filter((img) => img.id !== imageId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  return (
    <Card title="Картинки">
      {product.images.length === 0 ? (
        <div className="text-sm text-slate-500">Нет картинок</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {product.images.map((img) => (
            <div
              key={img.id}
              className={`relative aspect-square rounded-xl overflow-hidden border ${
                img.is_primary ? 'border-brand-500 ring-2 ring-brand-500/40' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover bg-slate-100 dark:bg-slate-800" />
              {img.is_primary && (
                <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-500 text-white">
                  PRIMARY
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 text-[10px]">
                {!img.is_primary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(img.id)}
                    className="flex-1 py-1 text-white hover:bg-brand-500/70"
                    title="Сделать главной"
                  >
                    ★
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  className="flex-1 py-1 text-red-300 hover:bg-red-500/70 hover:text-white"
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label
        className={`mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
          uploading ? 'opacity-50 cursor-wait' : ''
        }`}
      >
        {uploading ? 'Загрузка…' : '＋ Загрузить файл'}
        <input type="file" accept="image/*" disabled={uploading} className="hidden" onChange={handleUpload} />
      </label>
    </Card>
  );
}

// ---------- Helpers ----------
function PageWrap({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
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
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
