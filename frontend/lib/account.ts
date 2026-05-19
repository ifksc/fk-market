// FK.market — API ЛК покупателя (/api/me/*).
// Использует тот же токен, что и lib/auth.ts.

import { AuthError, getUserToken } from './auth';
import { API_URL } from './config';

export type MyOrderSummary = {
  public_number: string;
  status: 'pending' | 'paid' | 'fulfilling' | 'completed' | 'failed' | 'cancelled' | 'refunded';
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

/**
 * Метаданные статуса заказа для бейджа в ЛК — единый источник для дашборда
 * (/account), списка заказов и страницы заказа. Раньше каждая страница
 * держала свою копию switch — при добавлении статусов (fulfilling, failed)
 * их забывали обновить везде, и статус показывался по-английски.
 */
export function orderStatusMeta(
  status: MyOrderSummary['status'],
): { label: string; bg: string; text: string } {
  switch (status) {
    case 'completed':  return { label: 'Выдан', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' };
    case 'paid':       return { label: 'Оплачен', bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' };
    case 'fulfilling': return { label: 'Выдаётся', bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-400' };
    case 'pending':    return { label: 'Ожидает оплаты', bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' };
    case 'failed':     return { label: 'Ошибка', bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400' };
    case 'cancelled':  return { label: 'Отменён', bg: 'bg-gray-500/15', text: 'text-gray-600' };
    case 'refunded':   return { label: 'Возврат', bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' };
    default:           return { label: status, bg: 'bg-gray-500/15', text: 'text-gray-600' };
  }
}

export type MyOrderItem = {
  id: number;
  product: { id: number; name: string; slug: string } | null;
  qty: number;
  price: number;
  total: number;
  fulfillment_status: string;
  delivered_at: string | null;
  delivered_payload: string | null;
  /** Покупатель уже оставил отзыв на этот товар. */
  reviewed: boolean;
  /** Можно оставить отзыв (товар выдан и отзыва ещё нет). */
  can_review: boolean;
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

/** Отзыв на купленный товар. Премодерация — появится на сайте после одобрения. */
export async function submitReview(input: {
  product_id: number;
  rating: number;
  text?: string;
}): Promise<void> {
  await meFetch('/me/reviews', { method: 'POST', body: JSON.stringify(input) });
}

// ---------- Поддержка ----------
export type SupportTicket = {
  id: number;
  kind: 'code_not_working' | 'wrong_item' | 'other';
  subject: string;
  body: string;
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  admin_note: string | null;
  order_number: string | null;
  created_at: string | null;
  resolved_at: string | null;
};

export async function listMyTickets(): Promise<SupportTicket[]> {
  const r = await meFetch<{ data: SupportTicket[] }>('/me/support');
  return r.data;
}

export async function createTicket(input: {
  kind: SupportTicket['kind'];
  subject: string;
  body: string;
  order?: string;
}): Promise<SupportTicket> {
  const r = await meFetch<{ data: SupportTicket }>('/me/support', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return r.data;
}
