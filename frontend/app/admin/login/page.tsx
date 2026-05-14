'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { adminLogin } from '@/lib/admin';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminLogin(email, password);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <LogoMark size={40} />
          <span className="fk-logo text-2xl">FK.market · admin</span>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-4"
        >
          <h1 className="text-2xl font-bold mb-1">Вход в админку</h1>
          <p className="text-sm text-slate-400 mb-2">
            Только для пользователей с ролью admin.
          </p>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="w-full h-11 px-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full h-11 px-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-50"
          >
            {submitting ? 'Вход…' : 'Войти'}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Сидер по умолчанию: <code className="font-mono">admin@fk.market</code> / <code>admin123</code>
            <br />
            Поменяй пароль через CLI: <code className="font-mono">artisan tinker</code>
          </p>
        </form>
      </div>
    </div>
  );
}
