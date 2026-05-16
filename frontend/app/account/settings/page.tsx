'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getThemeMode, setThemeMode, type ThemeMode } from '@/components/ThemeProvider';
import { AuthError, logoutOtherSessions } from '@/lib/auth';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/account/settings');
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Загрузка…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Настройки</h1>
        <Link href="/account" className="text-sm text-gray-500 hover:text-brand-600">← В кабинет</Link>
      </div>

      <ThemeSection />
      <SessionsSection />
    </div>
  );
}

// ---------- Тема оформления ----------

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Светлая', icon: <Sun className="w-4 h-4" /> },
  { value: 'dark', label: 'Тёмная', icon: <Moon className="w-4 h-4" /> },
  { value: 'system', label: 'Системная', icon: <Monitor className="w-4 h-4" /> },
];

function ThemeSection() {
  // Тема читается из localStorage — только на клиенте, после монтирования,
  // иначе будет рассинхрон с SSR-разметкой.
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => { setMode(getThemeMode()); }, []);

  const choose = (value: ThemeMode) => {
    setThemeMode(value);
    setMode(value);
  };

  return (
    <Section title="Тема оформления">
      <p className="text-sm text-gray-500 mb-4">
        «Системная» подстраивается под настройки вашего устройства.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((opt) => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose(opt.value)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm transition-colors ${
                active
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

// ---------- Сеансы ----------

function SessionsSection() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const handleLogoutOthers = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const revoked = await logoutOtherSessions();
      setNotice({
        kind: 'ok',
        text: revoked > 0
          ? `Завершено остальных сеансов: ${revoked}`
          : 'Других активных сеансов не было',
      });
    } catch (e) {
      const text = e instanceof AuthError ? e.message : 'Не удалось завершить сеансы';
      setNotice({ kind: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Безопасность">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium">Завершить остальные сеансы</div>
          <p className="text-sm text-gray-500">
            Выход на всех других устройствах. Текущая сессия останется активной.
          </p>
        </div>
        <button
          onClick={handleLogoutOthers}
          disabled={busy}
          className="h-10 px-4 rounded-xl border border-gray-200 dark:border-slate-800 text-sm font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {busy ? 'Завершаем…' : 'Завершить'}
        </button>
      </div>
      {notice && (
        <div className={`mt-3 text-sm ${notice.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
          {notice.text}
        </div>
      )}
    </Section>
  );
}

// ---------- Общее ----------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}
