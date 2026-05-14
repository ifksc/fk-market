'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { toggleTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import { TelegramLoginButton, type TelegramUser } from '@/components/TelegramLoginButton';
import { AuthError, login, oauthTelegram, register } from '@/lib/auth';

const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'fkmarket_bot';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser, refresh } = useAuth();
  const initialTab = params.get('tab') === 'register' ? 'register' : 'login';
  const redirectTo = params.get('redirect') || '/account';

  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauthClick = (provider: string) => {
    alert(`OAuth ${provider} — следующий этап.`);
  };

  const onTelegramAuth = async (tgUser: TelegramUser) => {
    setError(null);
    setBusy(true);
    try {
      const { user, needs_email } = await oauthTelegram(tgUser);
      setUser(user);
      // Telegram не отдаёт email — направим юзера на профиль ввести его
      if (needs_email) {
        router.push('/account/profile?need=email');
      } else {
        router.push(user.email_verified ? redirectTo : '/verify-email');
      }
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Telegram-логин не удался');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === 'login') {
        const { user } = await login({ email, password });
        setUser(user);
        // Если email ещё не подтверждён — отправляем на ввод кода
        router.push(user.email_verified ? redirectTo : '/verify-email');
      } else {
        if (password !== passwordConfirm) {
          setError('Пароли не совпадают');
          return;
        }
        const { user } = await register({
          email,
          password,
          password_confirmation: passwordConfirm,
        });
        setUser(user);
        // После регистрации почта всегда неподтверждена → /verify-email
        router.push('/verify-email');
      }
      // На случай если ещё что-то нужно подтянуть с сервера
      refresh();
    } catch (e) {
      if (e instanceof AuthError) {
        setError(e.message);
      } else {
        setError('Неизвестная ошибка, попробуйте ещё раз');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <LogoMark size={40} />
          <span className="fk-logo text-2xl">FK.market</span>
        </Link>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-800 mb-6 text-sm">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 h-9 rounded-lg font-medium ${
                tab === 'login' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); }}
              className={`flex-1 h-9 rounded-lg font-medium ${
                tab === 'register' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Регистрация
            </button>
          </div>

          <h1 className="text-2xl font-bold mb-1">
            {tab === 'login' ? 'С возвращением' : 'Создать аккаунт'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {tab === 'login'
              ? 'Войдите, чтобы видеть свои заказы и баланс'
              : 'Чтобы получить персональный кабинет и историю покупок'}
          </p>

          {/* OAuth кнопки */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => oauthClick('VK')}
              className="h-11 rounded-xl text-white font-medium flex items-center justify-center gap-2"
              style={{ background: '#0077FF' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.2 17.3c-5.4 0-8.5-3.7-8.6-9.9h2.7c.1 4.5 2.1 6.4 3.7 6.8V7.4h2.5v3.9c1.6-.2 3.2-2 3.8-3.9h2.5c-.4 2.3-2.2 4.1-3.4 4.8 1.2.6 3.3 2.2 4.1 5.1h-2.8c-.6-2-2.1-3.5-4.2-3.7v3.7h-.3z" />
              </svg>
              VK
            </button>
            <button
              type="button"
              onClick={() => oauthClick('Яндекс')}
              className="h-11 rounded-xl text-white font-medium flex items-center justify-center gap-2"
              style={{ background: '#FC3F1D' }}
            >
              Я
            </button>
          </div>
          <div className="flex justify-center mb-5 min-h-[40px]">
            <TelegramLoginButton
              botUsername={TELEGRAM_BOT_USERNAME}
              size="large"
              cornerRadius={10}
              onAuth={onTelegramAuth}
            />
          </div>

          <div className="flex items-center gap-3 my-5 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
            или email
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
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
            <div>
              <label className="text-xs text-gray-500 mb-1 flex justify-between">
                <span>Пароль</span>
                {tab === 'login' && (
                  <Link href="/forgot-password" className="text-brand-600 hover:underline">
                    Забыли?
                  </Link>
                )}
              </label>
              <input
                type="password"
                placeholder={tab === 'register' ? 'от 8 символов' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={tab === 'register' ? 8 : undefined}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            {tab === 'register' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Повторите пароль</label>
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
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-60"
            >
              {busy
                ? 'Подождите…'
                : tab === 'login'
                  ? 'Войти'
                  : 'Создать аккаунт'}
            </button>
          </form>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Нажимая кнопку, вы принимаете{' '}
          <Link href="/legal/oferta" className="text-brand-600 hover:underline">
            оферту
          </Link>{' '}
          и{' '}
          <Link href="/legal/privacy" className="text-brand-600 hover:underline">
            политику конфиденциальности
          </Link>
        </p>

        <div className="text-center mt-6">
          <button onClick={toggleTheme} className="text-xs text-gray-400 hover:text-brand-600">
            Сменить тему
          </button>
        </div>
      </div>
    </div>
  );
}
