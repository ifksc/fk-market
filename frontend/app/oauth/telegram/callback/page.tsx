'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { useAuth } from '@/components/AuthProvider';
import { AuthError, oauthTelegramExchange } from '@/lib/auth';
import { popTelegramOAuthSession } from '@/lib/telegram-oauth';

export default function TelegramCallbackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const errorFromTg = params.get('error') ?? params.get('error_description');

    if (errorFromTg) {
      setError(`Telegram отказал: ${errorFromTg}`);
      return;
    }
    if (!code || !state) {
      setError('Telegram не вернул код входа');
      return;
    }

    const session = popTelegramOAuthSession(state);
    if (!session) {
      setError('Сессия истекла, попробуйте войти ещё раз');
      return;
    }

    (async () => {
      try {
        const { user, needs_email } = await oauthTelegramExchange({
          code,
          code_verifier: session.code_verifier,
          redirect_uri: session.redirect_uri,
        });
        setUser(user);
        router.replace(
          needs_email
            ? '/account/profile?need=email'
            : (user.email_verified ? '/account' : '/verify-email'),
        );
      } catch (e) {
        setError(e instanceof AuthError ? e.message : 'Не удалось завершить вход');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="flex items-center gap-2 justify-center mb-6">
            <LogoMark size={36} />
            <span className="fk-logo text-xl">FK.market</span>
          </Link>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-lg font-semibold mb-3">Войти через Telegram не получилось</h1>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <Link href="/login" className="text-sm text-brand-600 hover:underline">← Вернуться ко входу</Link>
          </div>
        </div>
      </div>
    );
  }
  return <Loading />;
}

function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Завершаем вход через Telegram…</p>
      </div>
    </div>
  );
}
