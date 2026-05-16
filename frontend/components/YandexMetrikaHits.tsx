'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const COUNTER_ID = 109257922;

/**
 * Трекинг SPA-переходов для Яндекс.Метрики.
 *
 * Счётчик (в layout) фиксирует только первую загрузку. В Next.js клиентская
 * навигация не перезагружает страницу — поэтому на смену пути шлём `hit`
 * вручную. Первый рендер пропускаем — этот просмотр уже учёл init счётчика.
 */
export function YandexMetrikaHits() {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    window.ym?.(COUNTER_ID, 'hit', window.location.href);
  }, [pathname]);

  return null;
}
