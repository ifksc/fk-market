import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgePercent, Check, ShieldCheck, Shield, Package, Key, PlayCircle, User, Zap, BrainCircuit } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { getCategories, getProducts } from '@/lib/api';

export const metadata: Metadata = {
  description:
    'FK.market — цифровые товары с моментальной выдачей: игровые ключи, пополнения Steam, PSN, Xbox, Telegram Stars, подписки. Оплата картой и СБП, выдача 24/7.',
  alternates: { canonical: '/' },
};

const ICON_BY_SLUG: Record<string, React.ComponentType<{ className?: string }>> = {
  ai: BrainCircuit,
  vpn: Shield,
  skins: Package,
  keys: Key,
  subs: PlayCircle,
  accounts: User,
  services: Zap,
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  ai: 'from-brand-500 via-fuchsia-500 to-pink-500',
  vpn: 'from-indigo-500 to-blue-500',
  skins: 'from-orange-500 to-red-500',
  keys: 'from-fuchsia-500 to-pink-500',
  subs: 'from-emerald-500 to-teal-500',
  accounts: 'from-yellow-500 to-orange-500',
  services: 'from-violet-500 to-fuchsia-500',
};

export default async function HomePage() {
  // Параллельно тянем категории, популярные (на 6 в hero + 8 в секции = 14) и новые
  const [categories, popularPage, newPage] = await Promise.all([
    getCategories(),
    getProducts({ sort: 'popular', per_page: 14 }),
    getProducts({ sort: 'new', per_page: 8 }),
  ]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-fuchsia-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" />
        <div className="absolute -z-10 top-20 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-3xl opacity-30 bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-pink-400 dark:opacity-20" />
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Левая колонка: текст и кнопки */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-300 mb-5">
                <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
                {popularPage.meta.total.toLocaleString('ru')} товаров · мгновенная выдача 24/7
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                Игры Steam, валюты<br />
                и подписки —{' '}
                <span className="fk-logo">мгновенно</span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-gray-600 dark:text-slate-300 max-w-xl">
                100+ актуальных Steam-релизов, пополнения PSN, Xbox и Nintendo, валюты Mobile Legends, Genshin, Valorant. Код приходит сразу после оплаты.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/catalog" className="h-12 px-6 rounded-xl fk-grad-btn font-medium flex items-center">
                  Открыть каталог
                </Link>
                <Link
                  href="#how"
                  className="h-12 px-6 rounded-xl border border-gray-300 dark:border-slate-700 font-medium flex items-center hover:bg-white dark:hover:bg-slate-900"
                >
                  Как это работает
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-accent-500" strokeWidth={3} />
                  98% мгновенно
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-accent-500" strokeWidth={2.5} />
                  14 дней гарантия
                </div>
                <div className="flex items-center gap-1.5">
                  <BadgePercent className="w-4 h-4 text-accent-500" strokeWidth={2.5} />
                  Накопительные скидки
                </div>
              </div>
            </div>

            {/* Правая колонка: сетка обложек популярных товаров */}
            <div className="grid grid-cols-3 gap-2.5">
              {popularPage.data.slice(0, 6).map((p) => {
                const grad = CATEGORY_GRADIENTS[p.category?.slug ?? ''] ?? 'from-slate-500 to-slate-700';
                return (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug}`}
                    className="group rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-500 transition flex flex-col"
                    title={p.name}
                  >
                    <div className={`aspect-[4/3] relative ${p.image ? 'bg-slate-800' : `bg-gradient-to-br ${grad}`} flex items-center justify-center`}>
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-white/85 text-xs font-bold tracking-wide text-center px-2 line-clamp-3">
                          {p.name}
                        </div>
                      )}
                    </div>
                    <div className="px-2.5 py-2 text-xs">
                      <div className="line-clamp-1 font-medium text-gray-700 dark:text-slate-200 mb-0.5">
                        {p.name}
                      </div>
                      <div className="font-bold">от {p.price.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ПОПУЛЯРНЫЕ ТОВАРЫ */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Популярные товары</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Покупают прямо сейчас</p>
          </div>
          <Link href="/catalog" className="text-brand-600 dark:text-brand-500 text-sm font-medium hover:underline">
            Смотреть все →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {popularPage.data.slice(6, 14).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {/* НОВЫЕ ТОВАРЫ */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Новые товары</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Свежие поступления</p>
          </div>
          <Link href="/catalog?sort=new" className="text-brand-600 dark:text-brand-500 text-sm font-medium hover:underline">
            Смотреть все →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {newPage.data.slice(0, 8).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {/* КАТЕГОРИИ */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Категории</h2>
          <Link href="/catalog" className="text-brand-600 dark:text-brand-500 text-sm font-medium hover:underline">
            Все →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {categories.filter((c) => c.parent_id === null).map((cat) => {
            const Icon = ICON_BY_SLUG[cat.slug] ?? Package;
            const grad = CATEGORY_GRADIENTS[cat.slug] ?? 'from-slate-500 to-slate-700';
            return (
              <Link
                key={cat.id}
                href={`/catalog?category=${cat.slug}`}
                className="fk-card fk-glow bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col relative"
              >
                {cat.is_new && (
                  <span className="absolute top-3 right-3 z-10 text-[10px] px-2 py-0.5 rounded-full fk-grad-btn font-bold">
                    NEW
                  </span>
                )}
                {cat.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="aspect-[4/3] w-full object-contain bg-slate-800"
                  />
                ) : (
                  <div
                    className={`aspect-[4/3] w-full bg-gradient-to-br ${grad} text-white flex items-center justify-center`}
                  >
                    <Icon className="w-10 h-10" />
                  </div>
                )}
                <div className="p-3">
                  <div className="font-semibold text-sm line-clamp-2 min-h-[2.5em]">{cat.name}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {cat.products_count.toLocaleString('ru')}{' '}
                    {pluralize(cat.products_count, ['товар', 'товара', 'товаров'])}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* КАК ЭТО РАБОТАЕТ */}
      <section id="how" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Как это работает</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">Три шага от выбора до выдачи</p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ['1', 'Выбираете товар', 'Игры Steam, пополнения консолей, игровые валюты, подписки, ИИ-аккаунты и VPN. Фильтры по цене и рейтингу.'],
            ['2', 'Оплачиваете удобным способом', 'Карта, СБП, электронные кошельки, крипта — все способы в одном окне.'],
            ['3', 'Получаете заказ сразу', 'Ключ или доступ приходит на email и в личный кабинет сразу после оплаты — и доступен повторно в любой момент.'],
          ].map(([n, title, text]) => (
            <div
              key={n}
              className="fk-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-brand-500 font-bold flex items-center justify-center mb-4">
                {n}
              </div>
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
