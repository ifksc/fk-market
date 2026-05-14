// FK.market — клиент авторизации покупателей.
// Токен Sanctum в localStorage ('fk-user-token'). Админский токен живёт отдельно
// в 'fk-admin-token' — это две независимые сессии.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://fk.market/api';
const TOKEN_KEY = 'fk-user-token';

export type AuthUser = {
  id: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: 'customer' | 'admin' | 'seller' | 'moderator';
  email_verified: boolean;
  balance: number;
  created_at: string | null;
};

export class AuthError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

// ---------- Хранение токена ----------
export function getUserToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setUserToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearUserToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

// ---------- Базовый fetch ----------
async function authFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getUserToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body as { message?: string })?.message ??
      `API ${path} → ${res.status}`;
    throw new AuthError(message, res.status, body);
  }
  return body as T;
}

type WrappedResponse<T> = { data: T };
type LoginResp = WrappedResponse<{ token: string; user: AuthUser }>;
type UserResp = WrappedResponse<{ user: AuthUser }>;

// ---------- API ----------
export async function register(input: {
  email: string;
  password: string;
  password_confirmation: string;
  name?: string;
}): Promise<{ token: string; user: AuthUser }> {
  const r = await authFetch<LoginResp>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setUserToken(r.data.token);
  return r.data;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const r = await authFetch<LoginResp>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setUserToken(r.data.token);
  return r.data;
}

export async function logout(): Promise<void> {
  try {
    await authFetch('/auth/logout', { method: 'POST' });
  } finally {
    clearUserToken();
  }
}

export async function me(): Promise<AuthUser | null> {
  if (!getUserToken()) return null;
  try {
    const r = await authFetch<WrappedResponse<AuthUser>>('/auth/me');
    return r.data;
  } catch (e) {
    if (e instanceof AuthError && (e.status === 401 || e.status === 403)) {
      clearUserToken();
      return null;
    }
    throw e;
  }
}

export async function verifyEmail(code: string): Promise<AuthUser> {
  const r = await authFetch<UserResp>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return r.data.user;
}

export async function resendVerification(): Promise<void> {
  await authFetch('/auth/resend-verification', { method: 'POST' });
}

export async function forgotPassword(email: string): Promise<void> {
  await authFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await authFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---------- ЛК: профиль ----------
export async function updateProfile(input: {
  name?: string | null;
  phone?: string | null;
}): Promise<AuthUser> {
  const r = await authFetch<{ data: AuthUser }>('/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return r.data;
}

export async function changePassword(input: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await authFetch('/me/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function changeEmailRequest(input: {
  new_email: string;
  password?: string; // не нужен для первого ввода email у OAuth-юзера
}): Promise<{ pending_email: string; first_time?: boolean }> {
  const r = await authFetch<{ data: { pending_email: string; sent: boolean; first_time?: boolean } }>('/me/change-email', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { pending_email: r.data.pending_email, first_time: r.data.first_time };
}

// ---------- OAuth ----------
export type TelegramAuthPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export async function oauthTelegram(payload: TelegramAuthPayload): Promise<{
  token: string;
  user: AuthUser;
  needs_email: boolean;
}> {
  const r = await authFetch<{ data: { token: string; user: AuthUser; needs_email: boolean } }>(
    '/auth/oauth/telegram/callback',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  setUserToken(r.data.token);
  return r.data;
}
