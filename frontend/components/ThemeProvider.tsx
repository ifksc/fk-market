'use client';

import { useEffect } from 'react';

/**
 * Применяет сохранённую тему к <html> при загрузке страницы.
 * Кладётся в layout.tsx — рендерится один раз на корне.
 */
export function ThemeProvider() {
  useEffect(() => {
    const saved = localStorage.getItem('fk-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', dark);
  }, []);
  return null;
}

export function toggleTheme() {
  const root = document.documentElement;
  root.classList.toggle('dark');
  localStorage.setItem('fk-theme', root.classList.contains('dark') ? 'dark' : 'light');
}
