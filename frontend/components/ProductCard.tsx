import Link from 'next/link';
import { Plus, Star } from 'lucide-react';
import type { Product } from '@/lib/types';

const CATEGORY_GRADIENTS: Record<string, string> = {
  ai: 'from-brand-500 via-fuchsia-500 to-pink-500',
  vpn: 'from-indigo-500 to-blue-600',
  skins: 'from-orange-500 to-rose-600',
  keys: 'from-fuchsia-500 to-purple-700',
  subs: 'from-emerald-500 to-teal-600',
  accounts: 'from-yellow-500 to-orange-500',
  services: 'from-violet-500 to-fuchsia-500',
};

export function ProductCard({ p }: { p: Product }) {
  const grad = CATEGORY_GRADIENTS[p.category?.slug ?? ''] ?? 'from-slate-500 to-slate-700';
  return (
    <Link
      href={`/products/${p.slug}`}
      className="fk-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden block"
    >
      <div className={`aspect-[4/3] relative ${p.image ? 'bg-slate-800' : `bg-gradient-to-br ${grad}`} flex items-center justify-center overflow-hidden`}>
        {/* Бейджи */}
        {p.discount_pct > 0 && (
          <span className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md bg-red-500 text-white text-[10px] font-bold">
            −{p.discount_pct}%
          </span>
        )}
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-white/80 text-2xl font-bold tracking-wide">
            {p.category?.name ?? '—'}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mb-1">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          {p.rating.toFixed(1)} · {p.sales_count.toLocaleString('ru')} продаж
        </div>
        <div className="font-semibold line-clamp-2 min-h-[44px] text-sm">{p.name}</div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-lg font-extrabold">
              {p.price.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
            </div>
            {p.price_old && (
              <div className="text-xs text-gray-400 line-through">
                {p.price_old.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
              </div>
            )}
          </div>
          <div className="w-9 h-9 rounded-xl fk-grad-btn flex items-center justify-center">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </div>
        </div>
      </div>
    </Link>
  );
}
