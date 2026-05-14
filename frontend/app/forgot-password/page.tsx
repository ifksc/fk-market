'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { AuthError, forgotPassword } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (e) {
      if (e instanceof AuthError) setError(e.message);
      else setError('Не удалось отправить письмо');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <LogoMark size={40} />
          <span className="fk-logo text-2xl">FK.market</span>
        </Link>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
          {sent ? (
            <>
              <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold text-center mb-2">Письмо отправлено</h1>
              <p className="text-sm text-gray-500 text-center">
                Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля.
                Проверьте «Входящие» и «Спам».
              </p>
              <div className="text-center mt-6">
                <Link href="/login" className="text-sm text-brand-600 hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Вернуться ко входу
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1">Сброс пароля</h1>
              <p className="text-sm text-gray-500 mb-6">Введите email — пришлём ссылку</p>

              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={busy} className="w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-60">
                  {busy ? 'Отправляем…' : 'Отправить ссылку'}
                </button>
              </form>

              <div className="text-center mt-6">
                <Link href="/login" className="text-sm text-gray-500 hover:text-brand-600 inline-flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Вернуться ко входу
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
