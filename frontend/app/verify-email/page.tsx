'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { useAuth } from '@/components/AuthProvider';
import { AuthError, resendVerification, verifyEmail } from '@/lib/auth';

const CODE_LEN = 6;
const RESEND_COOLDOWN = 60; // секунд

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, loading, refresh, setUser } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Если не залогинен — на /login
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Если email уже подтверждён — сразу в кабинет
  useEffect(() => {
    if (user?.email_verified) {
      router.replace('/account');
    }
  }, [user, router]);

  // Cooldown таймер
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Авто-фокус на первое поле
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const setDigitAt = (i: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < CODE_LEN - 1) inputRefs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LEN);
    if (!text) return;
    e.preventDefault();
    const arr = text.split('');
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < CODE_LEN; i++) next[i] = arr[i] ?? '';
      return next;
    });
    inputRefs.current[Math.min(text.length, CODE_LEN - 1)]?.focus();
  };

  const submit = async () => {
    const code = digits.join('');
    if (code.length !== CODE_LEN) return;
    setError(null);
    setBusy(true);
    try {
      const u = await verifyEmail(code);
      setUser(u);
      setSuccess(true);
      // Дадим 1.5 сек посмотреть «галочку» и улетим в кабинет
      setTimeout(() => router.push('/account'), 1500);
    } catch (e) {
      if (e instanceof AuthError) setError(e.message);
      else setError('Не удалось подтвердить, попробуйте ещё раз');
      setDigits(Array(CODE_LEN).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  // Авто-submit когда все 6 цифр введены
  useEffect(() => {
    if (digits.every((d) => d !== '') && !busy && !success) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const onResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      await resendVerification();
      setCooldown(RESEND_COOLDOWN);
    } catch (e) {
      if (e instanceof AuthError) setError(e.message);
      else setError('Не удалось отправить код');
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Загрузка…</div>;
  }
  if (!user) return null;

  if (success) {
    return (
      <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="flex items-center gap-2 justify-center mb-8">
            <LogoMark size={40} />
            <span className="fk-logo text-2xl">FK.market</span>
          </Link>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold mb-1">Почта подтверждена</h1>
            <p className="text-sm text-gray-500">Все ваши прошлые заказы привязаны к этому аккаунту.</p>
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

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center">
          <h1 className="text-2xl font-bold mb-1">Подтвердите почту</h1>
          <p className="text-sm text-gray-500 mb-6">
            Мы отправили 6-значный код на<br />
            <span className="font-semibold text-gray-700 dark:text-gray-300">{user.email}</span>
          </p>

          <div className="grid grid-cols-6 gap-2 mb-4">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                value={d}
                onChange={(e) => setDigitAt(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={onPaste}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                disabled={busy}
                className={`aspect-[1/1.2] text-center text-2xl font-mono rounded-xl border bg-white dark:bg-slate-900 ${
                  error
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-200 dark:border-slate-800 focus:border-brand-500'
                } outline-none transition-colors`}
              />
            ))}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 mb-3">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy || digits.some((d) => !d)}
            className="w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-60"
          >
            {busy ? 'Проверяем…' : 'Подтвердить'}
          </button>

          <div className="text-xs text-gray-500 mt-5">
            Не пришёл код?{' '}
            {cooldown > 0 ? (
              <span>Повторить через 0:{String(cooldown).padStart(2, '0')}</span>
            ) : (
              <button
                onClick={onResend}
                disabled={resending}
                className="text-brand-600 hover:underline disabled:opacity-50"
              >
                {resending ? 'Отправляем…' : 'Отправить ещё раз'}
              </button>
            )}
          </div>

          <div className="text-xs text-gray-400 mt-4">
            Не тот email?{' '}
            <button
              onClick={() => { void refresh(); router.push('/login'); }}
              className="text-brand-600 hover:underline"
            >
              Выйти и войти заново
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
