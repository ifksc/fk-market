'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { getAdminProducts, type AdminProductListItem } from '@/lib/admin';

export default function AdminStockPage() {
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Только товары с режимом 'stock' (где склад применим)
    getAdminProducts({ mode: 'stock', per_page: 100, sort: 'updated_desc' })
      .then((res) => setProducts(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const lowStock = products.filter((p) => p.stock_available !== null && p.stock_available <= 5);
  const outOfStock = products.filter((p) => p.stock_available === 0);

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 sticky top-0 z-30">
        <h1 className="font-bold text-lg">Склад ключей</h1>
      </header>

      <div className="p-6 space-y-6">
        {/* KPI */}
        <section className="grid md:grid-cols-3 gap-4">
          <Card>
            <div className="text-xs text-slate-500">Товаров со складом</div>
            <div className="text-2xl font-extrabold mt-1">{loading ? '—' : products.length}</div>
          </Card>
          <Card highlight={lowStock.length > 0 ? 'yellow' : undefined}>
            <div className="text-xs text-slate-500">Заканчиваются (≤5)</div>
            <div className="text-2xl font-extrabold mt-1">
              {loading ? '—' : lowStock.length}
            </div>
          </Card>
          <Card highlight={outOfStock.length > 0 ? 'red' : undefined}>
            <div className="text-xs text-slate-500">Закончились (0)</div>
            <div className="text-2xl font-extrabold mt-1">
              {loading ? '—' : outOfStock.length}
            </div>
          </Card>
        </section>

        {/* Список товаров со складом */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="font-bold flex items-center gap-2">
              <Boxes className="w-4 h-4" />
              Товары со складом ключей
            </div>
            <div className="text-xs text-slate-500">
              Клик по товару → загрузка / удаление ключей
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : products.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Нет товаров со складом</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {products.map((p) => {
                const avail = p.stock_available ?? 0;
                const tone =
                  avail === 0
                    ? 'bg-red-500/15 text-red-500'
                    : avail <= 5
                    ? 'bg-yellow-500/15 text-yellow-600'
                    : 'bg-emerald-500/15 text-emerald-600';
                return (
                  <Link
                    key={p.id}
                    href={`/admin/products/${p.id}/stock`}
                    className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium line-clamp-1">{p.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{p.slug}</div>
                    </div>
                    <div className="text-xs text-slate-500 hidden sm:block">{p.category?.name}</div>
                    <div className="text-right text-xs text-slate-500 hidden md:block">
                      Продаж: {p.sales_count.toLocaleString('ru')}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${tone}`}>
                      {avail} шт
                    </span>
                    <span className="text-brand-600 text-sm">Открыть →</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-500">
          Подсказка: если у товара режим выдачи <b>не «Склад»</b> — он сюда не попадёт.
          Для режимов «API» и «Ручная» склад ключей не нужен.
        </p>
      </div>
    </div>
  );
}

function Card({ children, highlight }: { children: React.ReactNode; highlight?: 'yellow' | 'red' }) {
  const cls =
    highlight === 'red'
      ? 'border-red-500/40 bg-red-500/5'
      : highlight === 'yellow'
      ? 'border-yellow-500/40 bg-yellow-500/5'
      : 'border-slate-200 dark:border-slate-800';
  return (
    <div className={`bg-white dark:bg-slate-900 border ${cls} rounded-2xl p-5`}>{children}</div>
  );
}
