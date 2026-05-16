'use client';

import { useEffect } from 'react';

/**
 * Тема оформления. Хранится в localStorage под ключом 'fk-theme':
 *   'dark' / 'light' — явный выбор пользователя;
 *   ключ отсутствует — «системная» (следуем prefers-color-scheme).
 */
export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'fk-theme';

/** Текущий режим из localStorage. По умолчанию — системный. */
export function getThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'dark' || saved === 'light' ? saved : 'system';
}

/** Применить тему к <html> в зависимости от режима. */
function applyMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

/** Сменить режим: сохранить в localStorage и применить немедленно. */
export function setThemeMode(mode: ThemeMode) {
  if (mode === 'system') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, mode);
  }
  applyMode(mode);
}

/**
 * Применяет сохранённую тему к <html> при загрузке страницы и следит за
 * системной темой, пока режим «системный». Кладётся в layout.tsx.
 */
export function ThemeProvider() {
  useEffect(() => {
    applyMode(getThemeMode());

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getThemeMode() === 'system') applyMode('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return null;
}

/** Быстрый переключатель тёмная/светлая (кнопка в шапке). */
export function toggleTheme() {
  const root = document.documentElement;
  root.classList.toggle('dark');
  localStorage.setItem(STORAGE_KEY, root.classList.contains('dark') ? 'dark' : 'light');
}
