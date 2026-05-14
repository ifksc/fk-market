// FK.market — клиент к нашему Laravel API
import type { ApiResponse, Category, Paginated, Product, ProductDetail } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://fk.market/api';

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
    throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
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
  items: Array<{
    product_id: number;
    qty: number;
    params?: Record<string, string>;
  }>;
};

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
  email: string;
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

export async function getOrderStatus(publicNumber: string): Promise<OrderStatus> {
  const r = await apiFetch<ApiResponse<OrderStatus>>(
    `/payments/fkwallet/check?order=${encodeURIComponent(publicNumber)}`,
    { cache: 'no-store' } as RequestInit,
  );
  return r.data;
}
