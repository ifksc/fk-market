'use client';

// FK.market — фильтры и сортировка каталога.
// Состояние фильтров живёт в URL searchParams (SSR сохраняется, ссылки шарятся).
// Компоненты client-only: меняют URL через router.push, серверная страница
// каталога перерисовывается с новыми параметрами.

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** Иконка фильтров — инлайн SVG, без зависимости от экспортов lucide. */
function FilterIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 6h18M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

/** Текущие query-параметры страницы каталога (всё — строки из URL). */
export type CatalogParams = Record<string, string | undefined>;

/** Собрать href: базовые параметры + переопределения; пустые значения отбрасываются. */
function buildHref(
  pathname: string,
  base: CatalogParams,
  overrides: CatalogParams,
): string {
  const sp = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

const MODES: Array<{ value: string; label: string; hint?: string }> = [
  { value: '', label: 'Любой' },
  { value: 'stock', label: 'Из склада', hint: 'мгновенно' },
  { value: 'api', label: 'Через API', hint: 'авто' },
  { value: 'manual', label: 'Ручная выдача' },
];

const RATINGS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Любой' },
  { value: '4.5', label: '4.5+ ★' },
  { value: '4', label: '4.0+ ★' },
  { value: '3', label: '3.0+ ★' },
];

const SORT_LABELS: Record<string, string> = {
  popular: 'По популярности',
  price_asc: 'По цене ↑',
  price_desc: 'По цене ↓',
  new: 'Сначала новые',
  rating: 'По рейтингу',
};

/**
 * Выпадающий список сортировки — применяется сразу при выборе.
 * `params` нужен, чтобы сохранить остальные query-параметры.
 */
export function SortSelect({ params, current }: { params: CatalogParams; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-gray-500">Сортировка:</label>
      <select
        value={current}
        onChange={(e) =>
          router.push(buildHref(pathname, params, { sort: e.target.value, page: undefined }))
        }
        className="h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Сайдбар фильтров: цена, способ выдачи, рейтинг.
 * Значения копятся в локальном состоянии, «Применить» коммитит их в URL.
 * На мобильном панель скрыта за кнопкой «Фильтры».
 */
export function CatalogFilters({ params }: { params: CatalogParams }) {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(params.min_price ?? '');
  const [maxPrice, setMaxPrice] = useState(params.max_price ?? '');
  const [mode, setMode] = useState(params.mode ?? '');
  const [minRating, setMinRating] = useState(params.min_rating ?? '');

  const activeCount =
    (params.min_price || params.max_price ? 1 : 0) +
    (params.mode ? 1 : 0) +
    (params.min_rating ? 1 : 0);

  const apply = () => {
    router.push(
      buildHref(pathname, params, {
        min_price: minPrice,
        max_price: maxPrice,
        mode,
        min_rating: minRating,
        page: undefined,
      }),
    );
  };

  const reset = () => {
    setMinPrice('');
    setMaxPrice('');
    setMode('');
    setMinRating('');
    router.push(
      buildHref(pathname, params, {
        min_price: undefined,
        max_price: undefined,
        mode: undefined,
        min_rating: undefined,
        page: undefined,
      }),
    );
  };

  return (
    <aside>
      {/* Мобильный переключатель панели */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="lg:hidden w-full h-11 mb-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-medium flex items-center justify-center gap-2"
      >
        <FilterIcon />
        Фильтры
        {activeCount > 0 && (
          <span className="text-xs fk-grad-btn px-2 py-0.5 rounded-full">{activeCount}</span>
        )}
      </button>

      <div className={`${open ? 'block' : 'hidden'} lg:block space-y-4`}>
        {/* Цена */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="font-semibold mb-3">Цена, ₽</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="от 0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-transparent text-sm"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="до 50 000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-transparent text-sm"
            />
          </div>
        </div>

        {/* Способ выдачи */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="font-semibold mb-3">Способ выдачи</div>
          <div className="space-y-2 text-sm">
            {MODES.map((m) => (
              <label key={m.value || 'any'} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  className="accent-brand-500"
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                {m.label}
                {m.hint && <span className="text-gray-400 ml-auto text-xs">{m.hint}</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Рейтинг */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="font-semibold mb-3">Рейтинг</div>
          <div className="space-y-2 text-sm">
            {RATINGS.map((r) => (
              <label key={r.value || 'any'} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="min_rating"
                  className="accent-brand-500"
                  checked={minRating === r.value}
                  onChange={() => setMinRating(r.value)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={apply}
            className="flex-1 h-11 rounded-xl fk-grad-btn font-medium"
          >
            Применить
          </button>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-gray-500"
            >
              Сброс
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
