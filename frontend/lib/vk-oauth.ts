// FK.market — VK ID OIDC client utilities.
// Структура повторяет lib/telegram-oauth.ts, отличия:
//   - AUTHORIZE_URL = https://id.vk.com/authorize
//   - VK PKCE-flow обязательно требует device_id в exchange-запросе.
//     VK ID сам генерирует device_id и возвращает его в callback как ?device_id=...
//   - scope: 'email vkid.personal_info' — даёт email + имя + photo в id_token.

// Сессия хранится под ключом `${STORAGE_PREFIX}:${state}` — с включением state.
// Так в sessionStorage уживаются несколько незавершённых попыток входа
// (повторный клик, кнопка «назад»), и callback находит именно свою по state.
const STORAGE_PREFIX = 'fk-vk-oauth';
const AUTHORIZE_URL = 'https://id.vk.com/authorize';

export type VkOAuthSession = {
  state: string;
  code_verifier: string;
  redirect_uri: string;
};

export function getVkClientId(): string {
  return process.env.NEXT_PUBLIC_VK_CLIENT_ID ?? '';
}

export function getRedirectUri(): string {
  if (typeof window === 'undefined') return 'https://fk.market/oauth/vk/callback';
  return `${window.location.origin}/oauth/vk/callback`;
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

/** Стартует OAuth: генерим PKCE, кладём session, редиректим на VK ID. */
export async function startVkOAuth(): Promise<void> {
  const clientId = getVkClientId();
  if (!clientId) {
    throw new Error('VK OAuth не сконфигурирован (нет NEXT_PUBLIC_VK_CLIENT_ID)');
  }

  const state = randomString(32);
  const verifier = randomString(64);
  const redirectUri = getRedirectUri();
  const challenge = await sha256Base64Url(verifier);

  const session: VkOAuthSession = {
    state,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  };
  sessionStorage.setItem(`${STORAGE_PREFIX}:${state}`, JSON.stringify(session));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email vkid.personal_info',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`);
}

/**
 * Читаем session обратно (в callback-странице) по state, который вернул VK.
 * Поиск по state заодно играет роль CSRF-проверки: подделанный/чужой state →
 * ключа в sessionStorage нет → null (callback покажет «сессия истекла»).
 */
export function popVkOAuthSession(state: string): VkOAuthSession | null {
  const key = `${STORAGE_PREFIX}:${state}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw) as VkOAuthSession;
  } catch {
    return null;
  }
}
