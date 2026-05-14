// FK.market — Telegram OIDC client utilities.
// Поток:
//   1. start(): генерим code_verifier + state, сохраняем в sessionStorage,
//      редиректим на oauth.telegram.org/auth с code_challenge.
//   2. После возврата с ?code&state — фронт-страница callback читает state
//      и code_verifier из sessionStorage и шлёт их на наш API.

const STORAGE_KEY = 'fk-tg-oauth';
const AUTHORIZE_URL = 'https://oauth.telegram.org/auth';

export type TelegramOAuthSession = {
  state: string;
  code_verifier: string;
  redirect_uri: string;
};

export function getTelegramClientId(): string {
  return process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID ?? '8721808579';
}

export function getRedirectUri(): string {
  if (typeof window === 'undefined') return 'https://fk.market/oauth/telegram/callback';
  return `${window.location.origin}/oauth/telegram/callback`;
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

/** Стартует OAuth: генерим PKCE, кладём session, редиректим на Telegram. */
export async function startTelegramOAuth(): Promise<void> {
  const state = randomString(32);
  const verifier = randomString(64);
  const redirectUri = getRedirectUri();
  const clientId = getTelegramClientId();
  const challenge = await sha256Base64Url(verifier);

  const session: TelegramOAuthSession = {
    state,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`);
}

/** Читаем session обратно (в callback-странице). */
export function popTelegramOAuthSession(): TelegramOAuthSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as TelegramOAuthSession;
  } catch {
    return null;
  }
}
