// FK.market — клиент к нашему Laravel API
import { API_URL } from './config';
import type { ApiResponse, Category, Paginated, Product, ProductDetail } from './types';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(opts?.headers ?? {}),
    },
    // ISR: 60 с кэширования на сервере Next, можно переопределять в вызове
    next: { revalidate: 60, ...(opts as { next?: object })?.next },
  });
  if (!res.ok) {
    // Пытаемся достать читаемый текст из тела ответа (Laravel отдаёт { message }).
    // Если тела нет или оно не JSON — показываем технический фолбэк.
    let message = `API ${path} → ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body?.message === 'string' && body.message.trim()) {
        message = body.message;
      }
    } catch {
      /* тело не JSON — оставляем фолбэк */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ---------- Категории ----------
export async function getCategories(): Promise<Category[]> {
  const r = await apiFetch<ApiResponse<Category[]>>('/categories');
  return r.data;
}

// ---------- Каталог товаров ----------
export type ProductsQuery = {
  category?: string;
  q?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  mode?: 'stock' | 'api' | 'manual';
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'new' | 'rating';
  page?: number;
  per_page?: number;
};

export async function getProducts(query: ProductsQuery = {}): Promise<Paginated<Product>> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return apiFetch<Paginated<Product>>(`/products${qs ? `?${qs}` : ''}`);
}

// ---------- Карточка товара ----------
export async function getProduct(slug: string): Promise<ProductDetail> {
  const r = await apiFetch<ApiResponse<ProductDetail>>(`/products/${slug}`);
  return r.data;
}

// ---------- FAQ ----------
export type FaqGroup = {
  category: string;
  items: Array<{ id: number; question: string; answer: string }>;
};

export async function getFaq(): Promise<FaqGroup[]> {
  const r = await apiFetch<ApiResponse<FaqGroup[]>>('/faq');
  return r.data;
}

// ---------- Способы оплаты ----------
export type PaymentMethodPublic = {
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  min_amount: number | null;
  max_amount: number | null;
  extra_fee_pct: number;
};

export async function getPaymentMethods(): Promise<PaymentMethodPublic[]> {
  const r = await apiFetch<ApiResponse<PaymentMethodPublic[]>>('/payment-methods');
  return r.data;
}

// ---------- Steam validate (для steam_login полей в карточке) ----------
export async function validateSteamLogin(login: string): Promise<{ isValid: boolean }> {
  const r = await apiFetch<ApiResponse<{ is_valid: boolean }>>(
    `/steam-validate?login=${encodeURIComponent(login)}`,
    { cache: 'no-store' } as RequestInit,
  );
  return { isValid: r.data.is_valid };
}

// ---------- Checkout ----------
export type CheckoutPayload = {
  email: string;
  phone?: string;
  // Произвольный code из таблицы payment_methods (был enum, но методы теперь конфигурируются в админке)
  payment_method?: string;
  // Промокод (опционально) — скидку считает и валидирует бэкенд
  promocode?: string;
  items: Array<{
    product_id: number;
    qty: number;
    params?: Record<string, string>;
  }>;
};

// ---------- Промокод ----------
export type PromocodeCheck = {
  valid: boolean;
  discount: number;
  total: number;
  message: string | null;
};

export async function checkPromocode(input: {
  code: string;
  items: Array<{ product_id: number; qty: number; params?: Record<string, string> }>;
}): Promise<PromocodeCheck> {
  const r = await apiFetch<ApiResponse<PromocodeCheck>>('/promocode/check', {
    method: 'POST',
    body: JSON.stringify(input),
    cache: 'no-store',
  } as RequestInit);
  return r.data;
}

// ---------- Поддержка (гостевое обращение) ----------
export async function createGuestTicket(input: {
  public_number: string;
  email: string;
  kind: 'code_not_working' | 'wrong_item' | 'other';
  subject: string;
  body: string;
}): Promise<void> {
  await apiFetch('/support', {
    method: 'POST',
    body: JSON.stringify(input),
    cache: 'no-store',
  } as RequestInit);
}

export type CheckoutResponse = {
  order_id: number;
  public_number: string;
  total: number;
  payment_url: string;
};

export async function createOrder(payload: CheckoutPayload): Promise<CheckoutResponse> {
  const r = await apiFetch<ApiResponse<CheckoutResponse>>('/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
    cache: 'no-store',
  } as RequestInit);
  return r.data;
}

// ---------- Проверка статуса заказа ----------
export type OrderStatus = {
  public_number: string;
  status: string;
  total: number;
  paid_at: string | null;
  items: Array<{
    product_id: number;
    product_name: string | null;
    qty: number;
    price: number;
    fulfillment_status: 'pending' | 'queued' | 'in_progress' | 'delivered' | 'failed';
    delivered_payload: string | null;
    delivered_at: string | null;
  }>;
};

export async function getOrderStatus(publicNumber: string, email?: string): Promise<OrderStatus> {
  // email подтверждает владение заказом — без него коды (delivered_payload)
  // не вернутся, только статус.
  const qs = new URLSearchParams({ order: publicNumber });
  if (email) qs.set('email', email);
  const r = await apiFetch<ApiResponse<OrderStatus>>(
    `/payments/fkwallet/check?${qs.toString()}`,
    { cache: 'no-store' } as RequestInit,
  );
  return r.data;
}
