'use client';

import { useState } from 'react';

type Props = {
  images: string[];
  fallbackGradient: string;
  fallbackLabel?: string;
  discountPct?: number;
  productName: string;
};

/**
 * Галерея картинок на странице товара. Если картинок несколько — миниатюры
 * под основной кликабельны. На server-side галерея не нужна, поэтому
 * выделено в отдельный клиентский компонент.
 */
export function ProductGallery({ images, fallbackGradient, fallbackLabel, discountPct = 0, productName }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = images.length > 0;
  const active = hasImages ? images[Math.min(activeIndex, images.length - 1)] : null;

  return (
    <>
      <div
        className={`aspect-[16/10] rounded-2xl flex items-center justify-center mb-3 relative overflow-hidden ${
          active ? 'bg-slate-100 dark:bg-slate-800' : `bg-gradient-to-br ${fallbackGradient}`
        }`}
      >
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active} alt={productName} className="w-full h-full object-contain" />
        ) : (
          <div className="text-white/80 text-3xl font-bold tracking-wide">{fallbackLabel ?? '—'}</div>
        )}
        {discountPct > 0 && (
          <span className="absolute top-4 left-4 px-2 py-1 rounded-md bg-red-500 text-white text-xs font-bold">
            −{discountPct}%
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 transition ${
                i === activeIndex
                  ? 'border-2 border-brand-500 ring-2 ring-brand-500/30'
                  : 'border border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
              }`}
              aria-label={`Картинка ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
