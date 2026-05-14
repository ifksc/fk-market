// FK.market — API ЛК покупателя (/api/me/*).
// Использует тот же токен, что и lib/auth.ts.

import { AuthError, getUserToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://fk.market/api';

export type MyOrderSummary = {
  public_number: string;
  status: 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded';
  total: number;
  currency: string;
  email: string;
  created_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  items_summary: Array<{
    product_name: string | null;
    qty: number;
    price: number;
    fulfillment_status: string;
  }>;
};

export type MyOrderItem = {
  id: number;
  product: { id: number; name: string; slug: string } | null;
  qty: number;
  price: number;
  total: number;
  fulfillment_status: string;
  delivered_at: string | null;
  delivered_payload: string | null;
};

export type MyOrderDetail = MyOrderSummary & {
  items: MyOrderItem[];
};

type Paginated<T> = {
  data: T[];
  meta: { total: number; per_page: number; current_page: number; last_page: number };
};

async function meFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
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
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const message = (body as { message?: string })?.message ?? `API ${path} → ${res.status}`;
    throw new AuthError(message, res.status, body);
  }
  return body as T;
}

export async function listMyOrders(params: { page?: number; status?: string } = {}): Promise<Paginated<MyOrderSummary>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.status) qs.set('status', params.status);
  const path = '/me/orders' + (qs.toString() ? `?${qs}` : '');
  return meFetch<Paginated<MyOrderSummary>>(path);
}

export async function getMyOrder(publicNumber: string): Promise<MyOrderDetail> {
  const r = await meFetch<{ data: MyOrderDetail }>(`/me/orders/${encodeURIComponent(publicNumber)}`);
  return r.data;
}

export async function resendOrderEmail(publicNumber: string): Promise<void> {
  await meFetch(`/me/orders/${encodeURIComponent(publicNumber)}/resend`, { method: 'POST' });
}
