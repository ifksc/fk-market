// FK.market — Яндекс ID OAuth client utilities.
// Структура повторяет lib/vk-oauth.ts, отличия:
//   - AUTHORIZE_URL = https://oauth.yandex.ru/authorize
//   - чистый OAuth 2.0 без OIDC, device_id не нужен;
//   - scope настраивается в кабинете oauth.yandex.ru (login:email login:info
//     login:avatar) — в authorize-URL не передаём.

const STORAGE_KEY = 'fk-yandex-oauth';
const AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize';

export type YandexOAuthSession = {
  state: string;
  code_verifier: string;
  redirect_uri: string;
};

export function getYandexClientId(): string {
  return process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID ?? '';
}

export function getRedirectUri(): string {
  if (typeof window === 'undefined') return 'https://fk.market/oauth/yandex/callback';
  return `${window.location.origin}/oauth/yandex/callback`;
}

function randomString(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

function base64Url(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64Url(buf);
}

/** Стартует OAuth: генерим PKCE, кладём session, редиректим на Яндекс ID. */
export async function startYandexOAuth(): Promise<void> {
  const clientId = getYandexClientId();
  if (!clientId) {
    throw new Error('Яндекс OAuth не сконфигурирован (нет NEXT_PUBLIC_YANDEX_CLIENT_ID)');
  }

  const state = randomString(32);
  const verifier = randomString(64);
  const redirectUri = getRedirectUri();
  const challenge = await sha256Base64Url(verifier);

  const session: YandexOAuthSession = {
    state,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`);
}

/** Читаем session обратно (в callback-странице). */
export function popYandexOAuthSession(): YandexOAuthSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as YandexOAuthSession;
  } catch {
    return null;
  }
}
