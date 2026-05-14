'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Mail } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { AuthError, resetPassword } from '@/lib/auth';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      await resetPassword({
        email,
        token,
        password,
        password_confirmation: passwordConfirm,
      });
      // После сброса все Sanctum-токены отозваны → надо логиниться заново.
      router.push('/login');
    } catch (e) {
      if (e instanceof AuthError) setError(e.message);
      else setError('Не удалось сменить пароль');
    } finally {
      setBusy(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="flex items-center gap-2 justify-center mb-8">
            <LogoMark size={40} />
            <span className="fk-logo text-2xl">FK.market</span>
          </Link>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-xl font-bold mb-2">Ссылка не работает</h1>
            <p className="text-sm text-gray-500 mb-4">Откройте ссылку из последнего письма с темой «Сброс пароля» или запросите новую.</p>
            <Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">
              Запросить новую ссылку
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <LogoMark size={40} />
          <span className="fk-logo text-2xl">FK.market</span>
        </Link>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold mb-1">Новый пароль</h1>
          <p className="text-sm text-gray-500 mb-4">Придумайте новый пароль для аккаунта</p>

          <div className="flex items-center gap-2 text-sm bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-900 rounded-lg px-3 py-2 mb-4">
            <Mail className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{email}</span>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Новый пароль</label>
              <input
                type="password"
                placeholder="от 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Повторите</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={busy} className="w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-60">
              {busy ? 'Сохраняем…' : 'Сохранить и войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
