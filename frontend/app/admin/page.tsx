'use client';

import { useEffect, useState } from 'react';
import { Boxes, ListOrdered, Package } from 'lucide-react';
import Link from 'next/link';
import { getAdminProducts, type AdminProductListItem } from '@/lib/admin';

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminProducts({ sort: 'sales', per_page: 5 })
      .then((res) => {
        setProducts(res.data);
        setTotal(res.meta.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 sticky top-0 z-30">
        <h1 className="font-bold text-lg">Дашборд</h1>
      </header>

      <div className="p-6 space-y-6">
        {/* Витрина-стат */}
        <section className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/products"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-brand-500 transition"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg fk-grad-btn flex items-center justify-center text-white">
                <Package className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-500">Всего товаров</div>
            </div>
            <div className="text-2xl font-extrabold">{loading ? '—' : total.toLocaleString('ru')}</div>
            <div className="text-xs text-slate-500 mt-2">Управление каталогом →</div>
          </Link>

          <Link
            href="/admin/orders"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-brand-500 transition"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                <ListOrdered className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-500">Заказы</div>
            </div>
            <div className="text-2xl font-extrabold">—</div>
            <div className="text-xs text-slate-500 mt-2">Список заказов (скоро) →</div>
          </Link>

          <Link
            href="/admin/stock"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-brand-500 transition"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white">
                <Boxes className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-500">Склад ключей</div>
            </div>
            <div className="text-2xl font-extrabold">—</div>
            <div className="text-xs text-slate-500 mt-2">Загрузка ключей (скоро) →</div>
          </Link>
        </section>

        {/* Топ продаж */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold">Топ-5 по продажам</div>
            <Link href="/admin/products" className="text-sm text-brand-600 hover:underline">
              Все товары →
            </Link>
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Загрузка…</div>
          ) : products.length === 0 ? (
            <div className="text-sm text-slate-500">Нет данных</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {products.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/products/${p.id}`}
                  className="flex items-center gap-3 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 -mx-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="line-clamp-1 font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.category?.name ?? '—'} · {p.fulfillment_mode}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{p.sales_count.toLocaleString('ru')}</div>
                    <div className="text-xs text-slate-500">продаж</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Заглушки */}
        <section className="bg-brand-50 dark:bg-slate-900 border border-brand-500/30 rounded-2xl p-6 text-sm">
          <b>Это начальная админка.</b> Сейчас работает: вход + список товаров (только просмотр).
          На следующих итерациях добавим:
          <ul className="mt-2 list-disc pl-5 space-y-0.5 text-slate-600 dark:text-slate-300">
            <li>Создание / редактирование товаров</li>
            <li>Массовая загрузка ключей (CSV или ручной ввод)</li>
            <li>Список заказов с фильтрами и просмотром деталей</li>
            <li>Очередь ручной выдачи</li>
            <li>Поставщики API</li>
            <li>Графики продаж и статистика</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
