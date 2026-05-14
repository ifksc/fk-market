'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { useCart } from '@/lib/cart';

const CATEGORY_GRADIENTS: Record<string, string> = {
  ai: 'from-brand-500 via-fuchsia-500 to-pink-500',
  vpn: 'from-indigo-500 to-blue-600',
  skins: 'from-orange-500 to-rose-600',
  keys: 'from-fuchsia-500 to-purple-700',
  subs: 'from-emerald-500 to-teal-600',
  accounts: 'from-yellow-500 to-orange-500',
  services: 'from-violet-500 to-fuchsia-500',
};

export default function CartPage() {
  const router = useRouter();
  const { items, remove, setQty, total, count, hydrated } = useCart();

  if (hydrated && items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl fk-grad-btn flex items-center justify-center mb-6">
          <Zap className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Корзина пуста</h1>
        <p className="text-gray-500 dark:text-slate-400 mb-8">
          Добавь что-нибудь из каталога — VPN, ИИ-аккаунт или ключ к игре.
        </p>
        <Link
          href="/catalog"
          className="inline-flex h-12 px-6 rounded-xl fk-grad-btn font-medium items-center"
        >
          Открыть каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Корзина</h1>

      {/* Степпер */}
      <ol className="flex items-center gap-4 text-sm mb-8">
        <li className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full fk-grad-btn flex items-center justify-center text-xs font-bold">
            1
          </span>
          <span className="font-medium">Корзина</span>
        </li>
        <li className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
        <li className="flex items-center gap-2 text-gray-400">
          <span className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold">
            2
          </span>
          <span>Оформление</span>
        </li>
        <li className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
        <li className="flex items-center gap-2 text-gray-400">
          <span className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold">
            3
          </span>
          <span>Готово</span>
        </li>
      </ol>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Список товаров */}
        <section className="space-y-3">
          {items.map((item) => {
            const grad = CATEGORY_GRADIENTS[item.category ?? ''] ?? 'from-slate-500 to-slate-700';
            return (
              <div
                key={item.product_id}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4"
              >
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                  />
                ) : (
                  <div
                    className={`w-20 h-20 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 text-white text-xs font-bold`}
                  >
                    {item.category?.toUpperCase().slice(0, 4) ?? '—'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-semibold hover:text-brand-600 line-clamp-1"
                  >
                    {item.name}
                  </Link>
                  {item.params && Object.keys(item.params).length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {Object.entries(item.params)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <div className="flex items-center border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setQty(item.product_id, item.qty - 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-10 text-center">{item.qty}</span>
                      <button
                        onClick={() => setQty(item.product_id, item.qty + 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => remove(item.product_id)}
                      className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Удалить
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold">
                    {(item.price * item.qty).toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
                  </div>
                  {item.qty > 1 && (
                    <div className="text-xs text-gray-400">
                      {item.price.toLocaleString('ru')} × {item.qty}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Сводка */}
        <aside className="lg:sticky lg:top-20 self-start space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="font-bold text-lg mb-4">Итого</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Товары ({count})</span>
                <span>{total.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽</span>
              </div>
              <div className="border-t border-gray-200 dark:border-slate-800 my-3" />
              <div className="flex justify-between text-lg font-extrabold">
                <span>К оплате</span>
                <span>{total.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽</span>
              </div>
            </div>
            <button
              onClick={() => router.push('/checkout')}
              className="mt-5 w-full h-12 rounded-xl fk-grad-btn font-semibold"
            >
              Перейти к оформлению
            </button>
            <div className="mt-3 text-center">
              <Link href="/catalog" className="text-xs text-gray-500 hover:text-brand-600">
                ← Продолжить покупки
              </Link>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 text-xs text-gray-500 dark:text-slate-400 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent-500" />
              Безопасная оплата
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent-500" />
              Мгновенная выдача после оплаты
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
