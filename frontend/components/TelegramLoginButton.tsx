'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Telegram Login Widget — официальная кнопка от Telegram.
 *
 * После клика юзер авторизуется в Telegram (если он там залогинен — поток в один клик),
 * Telegram вызывает window-функцию с payload {id, first_name, ..., hash}.
 * Подпись проверяется на бэке (POST /api/auth/oauth/telegram/callback).
 *
 * Виджет требует:
 *   - бот с domain=fk.market (BotFather /setdomain)
 *   - https-сайт
 *
 * Локально (на http://localhost) виджет не работает — это нормально.
 */
export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    [key: `onTelegramAuth_${string}`]: ((user: TelegramUser) => void) | undefined;
  }
}

export function TelegramLoginButton({
  botUsername,
  onAuth,
  size = 'large',
  cornerRadius,
}: {
  botUsername: string;
  onAuth: (user: TelegramUser) => void;
  size?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
}) {
  // Уникальный id callback'а, чтобы виджеты не пересекались
  const rawId = useId();
  const callbackName = `onTelegramAuth_${rawId.replace(/[^a-z0-9]/gi, '')}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Регистрируем глобальный callback под уникальным именем
    window[callbackName as `onTelegramAuth_${string}`] = (user: TelegramUser) => {
      onAuthRef.current(user);
    };

    // Чистим — на случай ре-маунта
    container.innerHTML = '';

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', size);
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    script.setAttribute('data-request-access', 'write');
    if (cornerRadius !== undefined) {
      script.setAttribute('data-radius', String(cornerRadius));
    }

    container.appendChild(script);

    return () => {
      delete window[callbackName as `onTelegramAuth_${string}`];
      container.innerHTML = '';
    };
  }, [botUsername, size, cornerRadius, callbackName]);

  return <div ref={containerRef} />;
}
