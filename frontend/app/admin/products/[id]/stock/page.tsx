'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, Upload } from 'lucide-react';
import {
  addAdminStock,
  deleteAdminStockItem,
  getAdminProduct,
  getAdminStock,
  type AdminProductDetail,
  type AdminStockItem,
} from '@/lib/admin';

export default function AdminProductStockPage() {
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);

  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [items, setItems] = useState<AdminStockItem[]>([]);
  const [meta, setMeta] = useState<{ total: number; available: number; sold: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [textarea, setTextarea] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [addedFlash, setAddedFlash] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, stock] = await Promise.all([getAdminProduct(productId), getAdminStock(productId)]);
      setProduct(p);
      setItems(stock.data);
      setMeta(stock.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const onAdd = async () => {
    const lines = textarea
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;
    setAdding(true);
    setError(null);
    try {
      const res = await addAdminStock(productId, lines, note || undefined);
      setAddedFlash(`Добавлено ${res.created} ключей. Доступно: ${res.stock_available}`);
      setTimeout(() => setAddedFlash(null), 5000);
      setTextarea('');
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить');
    } finally {
      setAdding(false);
    }
  };

  const onDelete = async (itemId: number) => {
    if (!confirm('Удалить ключ из склада?')) return;
    try {
      await deleteAdminStockItem(productId, itemId);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  };

  if (loading && !product) return <div className="p-6 text-sm text-slate-500">Загрузка…</div>;
  if (!product) return <div className="p-6 text-sm text-red-500">{error ?? 'Не найдено'}</div>;

  const linesCount = textarea.split(/\r?\n/).filter((l) => l.trim()).length;

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 sticky top-0 z-30 gap-4">
        <Link
          href={`/admin/products/${productId}`}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-bold text-lg line-clamp-1">Склад · {product.name}</h1>
          <div className="text-xs text-slate-500">
            Всего {meta?.total ?? 0} · в наличии {meta?.available ?? 0} · продано {meta?.sold ?? 0}
          </div>
        </div>
      </header>

      <div className="p-6 grid lg:grid-cols-[1fr_400px] gap-6 max-w-7xl">
        {/* Список ключей */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="font-bold">Ключи</div>
            <div className="text-xs text-slate-500">Показаны только превью (первые/последние 4 символа)</div>
          </div>
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Нет загруженных ключей</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((it) => (
                <div key={it.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <code className="font-mono flex-1 break-all">{it.preview}</code>
                  {it.is_sold ? (
                    <span className="px-2 py-1 rounded-md bg-slate-500/15 text-slate-500 text-xs">
                      продан · заказ #{it.sold_order_id}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-600 text-xs">в наличии</span>
                  )}
                  {it.note && <span className="text-xs text-slate-500">{it.note}</span>}
                  {!it.is_sold && (
                    <button
                      onClick={() => onDelete(it.id)}
                      className="text-slate-400 hover:text-red-500 p-1"
                      aria-label="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Форма добавления */}
        <aside className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="font-bold mb-1 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Добавить ключи
            </div>
            <p className="text-xs text-slate-500 mb-3">
              По одному ключу в строку. Можно вставить из CSV или текстового файла. Ключи шифруются на лету.
            </p>
            <textarea
              value={textarea}
              onChange={(e) => setTextarea(e.target.value)}
              placeholder={'KEY-AAAA-BBBB-1111\nKEY-CCCC-DDDD-2222\nuser@example.com:password123\n…'}
              rows={10}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>{linesCount} ключей в очереди на добавление</span>
              <button
                onClick={() => setTextarea('')}
                className="hover:text-slate-700 dark:hover:text-slate-300"
                disabled={!textarea}
              >
                Очистить
              </button>
            </div>

            <div className="mt-3">
              <label className="text-xs text-slate-500 mb-1 block">Комментарий (партия / источник)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="например, партия 2026-04-23"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <button
              onClick={onAdd}
              disabled={adding || linesCount === 0}
              className="mt-4 w-full h-11 rounded-xl fk-grad-btn text-sm font-semibold disabled:opacity-50"
            >
              {adding ? 'Загрузка…' : `Добавить ${linesCount > 0 ? linesCount + ' ' : ''}ключ(ей)`}
            </button>

            {addedFlash && (
              <div className="mt-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm p-3 border border-emerald-500/30">
                ✓ {addedFlash}
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-lg bg-red-500/10 text-red-600 text-sm p-3 border border-red-500/30">
                {error}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
