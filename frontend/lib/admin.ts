// FK.market — клиент к /api/admin/* и хранение токена админа

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://fk.market/api';
const TOKEN_KEY = 'fk-admin-token';

export type AdminUser = {
  id: number;
  name: string | null;
  email: string;
  role: 'admin';
};

export type AdminProductListItem = {
  id: number;
  slug: string;
  name: string;
  category: { slug: string; name: string } | null;
  provider: { code: string; name: string } | null;
  fulfillment_mode: 'stock' | 'api' | 'manual';
  fulfillment_fallback: 'manual' | 'none';
  price_base: number;
  price_final: number;
  markup_pct: number | null;
  stock_available: number | null;
  sales_count: number;
  rating: number;
  status: 'draft' | 'active' | 'archived';
  created_at: string | null;
  updated_at: string | null;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
};

// ---------- Хранение токена ----------
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

// ---------- Базовый fetch для админки ----------
async function adminFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
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

  if (res.status === 401) {
    // Просрочен или невалиден — выкидываем особую ошибку, layout сам сделает редирект
    clearAdminToken();
    throw new AdminUnauthorizedError();
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

export class AdminUnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'AdminUnauthorizedError';
  }
}

// ---------- Auth ----------
export async function adminLogin(email: string, password: string): Promise<AdminUser> {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Не удалось войти');
  }

  const json = (await res.json()) as { data: { token: string; user: AdminUser } };
  setAdminToken(json.data.token);
  return json.data.user;
}

export async function adminMe(): Promise<AdminUser> {
  const r = await adminFetch<{ data: AdminUser }>('/admin/me');
  return r.data;
}

export async function adminLogout(): Promise<void> {
  try {
    await adminFetch('/admin/logout', { method: 'POST' });
  } catch {
    // ignore
  } finally {
    clearAdminToken();
  }
}

// ---------- Товары ----------
export type AdminProductsQuery = {
  q?: string;
  status?: 'draft' | 'active' | 'archived';
  category?: string;
  mode?: 'stock' | 'api' | 'manual';
  sort?: 'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc' | 'name' | 'price_asc' | 'price_desc' | 'sales';
  page?: number;
  per_page?: number;
};

// ---------- Пользователи (админка) ----------
export type AdminUserListItem = {
  id: number;
  email: string;
  name: string | null;
  role: 'customer' | 'admin' | 'seller' | 'moderator';
  email_verified: boolean;
  is_blocked: boolean;
  balance: number;
  orders_count: number;
  orders_total_sum: number;
  created_at: string | null;
  last_login_at: string | null;
};

export type AdminUserOrderItem = {
  product_name: string | null;
  product_slug: string | null;
  qty: number;
  price: number;
  fulfillment_status: string;
};

export type AdminUserOrder = {
  public_number: string;
  status: 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded';
  total: number;
  currency: string;
  created_at: string | null;
  paid_at: string | null;
  items: AdminUserOrderItem[];
};

export type AdminUserDetail = AdminUserListItem & {
  phone: string | null;
  last_login_ip: string | null;
  orders: AdminUserOrder[];
};

export type AdminUsersQuery = {
  q?: string;
  role?: 'customer' | 'admin' | 'seller' | 'moderator';
  sort?: 'created_desc' | 'created_asc' | 'email' | 'orders_desc' | 'spent_desc';
  page?: number;
  per_page?: number;
};

export async function listAdminUsers(query: AdminUsersQuery = {}): Promise<Paginated<AdminUserListItem>> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return adminFetch<Paginated<AdminUserListItem>>(`/admin/users${qs ? `?${qs}` : ''}`);
}

export async function getAdminUser(id: number): Promise<AdminUserDetail> {
  const r = await adminFetch<{ data: AdminUserDetail }>(`/admin/users/${id}`);
  return r.data;
}

export async function getAdminProducts(query: AdminProductsQuery = {}): Promise<Paginated<AdminProductListItem>> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return adminFetch<Paginated<AdminProductListItem>>(`/admin/products${qs ? `?${qs}` : ''}`);
}

// ---------- Товар (детали + CRUD) ----------
export type AdminCategory = { id: number; slug: string; name: string };

export type AdminProductDetail = {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category_id: number;
  category: { slug: string; name: string } | null;
  provider_id: number | null;
  provider_external_id: string | null;
  fulfillment_mode: 'stock' | 'api' | 'manual';
  fulfillment_fallback: 'manual' | 'none';
  price_base: number;
  price_final: number;
  price_old: number | null;
  markup_pct: number | null;
  currency: string;
  required_params: Array<{ name: string; label: string; type: string; required: boolean }> | null;
  status: 'draft' | 'active' | 'archived';
  stock_total: number;
  stock_available: number;
  stock_sold: number;
  images: Array<{ id: number; url: string; is_primary: boolean }>;
};

export type AdminProductInput = Partial<{
  name: string;
  slug: string;
  category_id: number;
  short_description: string | null;
  description: string | null;
  price_base: number;
  markup_pct: number | null;
  price_old: number | null;
  fulfillment_mode: 'stock' | 'api' | 'manual';
  fulfillment_fallback: 'manual' | 'none';
  provider_id: number | null;
  provider_external_id: string | null;
  required_params: Array<{ name: string; label: string; type: string; required: boolean }> | null;
  status: 'draft' | 'active' | 'archived';
}>;

export async function getAdminProduct(id: number): Promise<AdminProductDetail> {
  const r = await adminFetch<{ data: AdminProductDetail }>(`/admin/products/${id}`);
  return r.data;
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  // 500 — больше, чем у нас сейчас в каталоге (~220), хватит для селекта
  const r = await adminFetch<{ data: AdminCategory[] }>('/admin/categories?per_page=500');
  return r.data;
}

// ---------- Категории (CRUD) ----------
export type AdminCategoryFull = {
  id: number;
  parent_id: number | null;
  provider_id: number | null;
  provider_external_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  show_in_header: boolean;
  is_new: boolean;
  products_count: number;
  is_from_provider: boolean;
};

export type AdminCategoryQuery = {
  filter?: 'ours' | 'providers' | 'roots';
  q?: string;
  page?: number;
  per_page?: number;
};

export type AdminCategoryInput = Partial<{
  name: string;
  slug: string;
  parent_id: number | null;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  show_in_header: boolean;
  is_new: boolean;
}>;

export async function listAdminCategories(query: AdminCategoryQuery = {}): Promise<Paginated<AdminCategoryFull>> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return adminFetch<Paginated<AdminCategoryFull>>(`/admin/categories${qs ? `?${qs}` : ''}`);
}

export async function getAdminCategory(id: number): Promise<AdminCategoryFull> {
  const r = await adminFetch<{ data: AdminCategoryFull }>(`/admin/categories/${id}`);
  return r.data;
}

export async function createAdminCategory(data: AdminCategoryInput): Promise<AdminCategoryFull> {
  const r = await adminFetch<{ data: AdminCategoryFull }>('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.data;
}

export async function updateAdminCategory(id: number, data: AdminCategoryInput): Promise<AdminCategoryFull> {
  const r = await adminFetch<{ data: AdminCategoryFull }>(`/admin/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return r.data;
}

export async function deleteAdminCategory(id: number): Promise<void> {
  await adminFetch(`/admin/categories/${id}`, { method: 'DELETE' });
}

// ---------- Способы оплаты ----------
export type AdminPaymentMethod = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  fk_id: number | null;
  integration_mode: 'sci' | 'api';
  is_enabled: boolean;
  sort_order: number;
  min_amount: number | null;
  max_amount: number | null;
  extra_fee_pct: number;
  config: Record<string, unknown> | null;
};

export type AdminPaymentMethodInput = Partial<Omit<AdminPaymentMethod, 'id'>>;

export async function listAdminPaymentMethods(): Promise<AdminPaymentMethod[]> {
  const r = await adminFetch<{ data: AdminPaymentMethod[] }>('/admin/payment-methods');
  return r.data;
}
export async function getAdminPaymentMethod(id: number): Promise<AdminPaymentMethod> {
  const r = await adminFetch<{ data: AdminPaymentMethod }>(`/admin/payment-methods/${id}`);
  return r.data;
}
export async function createAdminPaymentMethod(data: AdminPaymentMethodInput): Promise<AdminPaymentMethod> {
  const r = await adminFetch<{ data: AdminPaymentMethod }>('/admin/payment-methods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.data;
}
export async function updateAdminPaymentMethod(id: number, data: AdminPaymentMethodInput): Promise<AdminPaymentMethod> {
  const r = await adminFetch<{ data: AdminPaymentMethod }>(`/admin/payment-methods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return r.data;
}
export async function deleteAdminPaymentMethod(id: number): Promise<void> {
  await adminFetch(`/admin/payment-methods/${id}`, { method: 'DELETE' });
}
export async function reorderAdminPaymentMethods(orderedIds: number[]): Promise<void> {
  await adminFetch('/admin/payment-methods/reorder', {
    method: 'POST',
    body: JSON.stringify({ order: orderedIds }),
  });
}

/**
 * Загружает картинку категории. multipart/form-data — поэтому не используем
 * adminFetch (там жёстко стоит Content-Type: application/json).
 */
export async function uploadAdminCategoryImage(id: number, file: File): Promise<AdminCategoryFull> {
  const token = getAdminToken();
  const form = new FormData();
  form.append('image', file);

  const res = await fetch(`${API_URL}/admin/categories/${id}/image`, {
    method: 'POST',
    body: form,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new AdminUnauthorizedError();
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed → ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: AdminCategoryFull };
  return json.data;
}

export async function createAdminProduct(data: AdminProductInput): Promise<AdminProductDetail> {
  const r = await adminFetch<{ data: AdminProductDetail }>('/admin/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.data;
}

// ---------- Картинки товара ----------
export async function uploadAdminProductImage(
  productId: number,
  file: File,
  isPrimary = false,
): Promise<{ id: number; url: string; is_primary: boolean }> {
  const token = getAdminToken();
  const form = new FormData();
  form.append('image', file);
  if (isPrimary) form.append('is_primary', '1');

  const res = await fetch(`${API_URL}/admin/products/${productId}/images`, {
    method: 'POST',
    body: form,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new AdminUnauthorizedError();
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed → ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: { id: number; url: string; is_primary: boolean } };
  return json.data;
}

export async function makeAdminProductImagePrimary(productId: number, imageId: number): Promise<void> {
  await adminFetch(`/admin/products/${productId}/images/${imageId}/primary`, { method: 'PUT' });
}

export async function deleteAdminProductImage(productId: number, imageId: number): Promise<void> {
  await adminFetch(`/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' });
}

export async function updateAdminProduct(id: number, data: AdminProductInput): Promise<AdminProductDetail> {
  const r = await adminFetch<{ data: AdminProductDetail }>(`/admin/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return r.data;
}

export async function archiveAdminProduct(id: number): Promise<void> {
  await adminFetch(`/admin/products/${id}`, { method: 'DELETE' });
}

// ---------- Склад ключей ----------
export type AdminStockItem = {
  id: number;
  preview: string;
  note: string | null;
  is_sold: boolean;
  sold_at: string | null;
  sold_order_id: number | null;
  created_at: string | null;
};

export type AdminStockResponse = {
  data: AdminStockItem[];
  meta: { total: number; available: number; sold: number };
};

export async function getAdminStock(productId: number): Promise<AdminStockResponse> {
  return adminFetch<AdminStockResponse>(`/admin/products/${productId}/stock`);
}

export async function addAdminStock(
  productId: number,
  payloads: string[],
  note?: string,
): Promise<{ created: number; stock_available: number }> {
  const r = await adminFetch<{ data: { created: number; stock_available: number } }>(
    `/admin/products/${productId}/stock`,
    { method: 'POST', body: JSON.stringify({ payloads, note }) },
  );
  return r.data;
}

export async function deleteAdminStockItem(productId: number, stockItemId: number): Promise<void> {
  await adminFetch(`/admin/products/${productId}/stock/${stockItemId}`, { method: 'DELETE' });
}

// ---------- Заказы ----------
export type AdminOrderListItem = {
  id: number;
  public_number: string;
  email: string;
  total: number;
  status: 'pending' | 'paid' | 'fulfilling' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  items_count: number;
  created_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
};

export type AdminOrderDetail = AdminOrderListItem & {
  user: { id: number; email: string; name: string | null } | null;
  phone: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  ip: string | null;
  items: Array<{
    id: number;
    product_id: number;
    product_name: string | null;
    product_slug: string | null;
    qty: number;
    price: number;
    total: number;
    params: Record<string, string> | null;
    fulfillment_status: 'pending' | 'queued' | 'in_progress' | 'delivered' | 'failed';
    delivered_payload: string | null;
    delivered_at: string | null;
  }>;
  payments: Array<{
    id: number;
    provider: string;
    method: string | null;
    amount: number;
    status: string;
    provider_payment_id: string | null;
    paid_at: string | null;
  }>;
};

export type AdminOrdersQuery = {
  q?: string;
  status?: AdminOrderListItem['status'];
  from?: string;
  to?: string;
  sort?: 'created_desc' | 'created_asc' | 'total_desc';
  page?: number;
  per_page?: number;
};

export async function getAdminOrders(query: AdminOrdersQuery = {}): Promise<Paginated<AdminOrderListItem>> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return adminFetch<Paginated<AdminOrderListItem>>(`/admin/orders${qs ? `?${qs}` : ''}`);
}

export async function getAdminOrder(id: number): Promise<AdminOrderDetail> {
  const r = await adminFetch<{ data: AdminOrderDetail }>(`/admin/orders/${id}`);
  return r.data;
}

export async function adminOrderAction(
  id: number,
  action: 'cancel' | 'refund' | 'redeliver' | 'refulfill',
): Promise<void> {
  await adminFetch(`/admin/orders/${id}/${action}`, { method: 'POST' });
}

// ---------- Очередь выдачи ----------
export type QueueTask = {
  id: number;
  mode: 'api' | 'manual';
  status: 'queued' | 'in_progress' | 'done' | 'failed' | 'cancelled';
  order_item_id: number;
  order: { id: number; public_number: string; email: string } | null;
  product: { id: number; name: string; slug: string } | null;
  provider: { code: string; name: string } | null;
  input_params: Record<string, string> | null;
  assignee: { id: number; name: string | null; email: string } | null;
  retries: number;
  error_text: string | null;
  deadline_at: string | null;
  is_overdue: boolean;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
};

export type QueueResponse = Paginated<QueueTask> & {
  meta: Paginated<QueueTask>['meta'] & {
    open_count: number;
    overdue_count: number;
  };
};

export async function getAdminQueue(filter: 'open' | 'mine' | 'overdue' | 'done' | 'failed' | 'all' = 'open'): Promise<QueueResponse> {
  return adminFetch<QueueResponse>(`/admin/queue?filter=${filter}`);
}

export async function adminQueueAction(
  taskId: number,
  action: 'claim' | 'complete' | 'cancel',
  body?: Record<string, unknown>,
): Promise<void> {
  await adminFetch(`/admin/queue/${taskId}/${action}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---------- Поставщики ----------
export type ProviderSettings = {
  auto_sync_enabled?: boolean;
  auto_sync_interval_minutes?: number;
  auto_update_prices?: boolean;
  auto_hide_missing?: boolean;
  [k: string]: unknown;
};

export type AdminProvider = {
  id: number;
  code: string;
  name: string;
  base_url: string | null;
  is_enabled: boolean;
  status: 'ok' | 'degraded' | 'error' | 'disabled';
  last_sync_at: string | null;
  last_error_at: string | null;
  last_error_text: string | null;
  products_count: number;
  has_credentials: boolean;
  settings?: ProviderSettings | null;
};

export async function getAdminProviders(): Promise<AdminProvider[]> {
  const r = await adminFetch<{ data: AdminProvider[] }>('/admin/providers');
  return r.data;
}

export async function getAdminProvider(id: number): Promise<AdminProvider> {
  const r = await adminFetch<{ data: AdminProvider }>(`/admin/providers/${id}`);
  return r.data;
}

export async function updateAdminProvider(
  id: number,
  data: Partial<{
    name: string;
    base_url: string | null;
    credentials: string | null;
    is_enabled: boolean;
    settings: ProviderSettings;
  }>,
): Promise<void> {
  await adminFetch(`/admin/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export type ProviderSyncRun = {
  id: number;
  trigger: 'cron' | 'manual' | 'api';
  status: 'running' | 'ok' | 'error';
  started_at: string | null;
  finished_at: string | null;
  duration_sec: number | null;
  categories_synced: number;
  products_added: number;
  products_updated: number;
  products_stale: number;
  refresh_updated: number;
  refresh_hidden: number;
  refresh_restored: number;
  refresh_variants_removed: number;
  error_text: string | null;
};

export async function getAdminProviderSyncRuns(id: number, limit = 10): Promise<ProviderSyncRun[]> {
  const r = await adminFetch<{ data: ProviderSyncRun[] }>(`/admin/providers/${id}/sync-runs?limit=${limit}`);
  return r.data;
}

// ---------- Наценки ----------
export type AdminPricingRule = {
  id: number;
  scope: 'global' | 'category' | 'seller' | 'product';
  scope_id: number | null;
  scope_name: string | null;
  markup_pct: number;
  priority: number;
  is_active: boolean;
};

export type PricingRecomputeBatch = {
  scanned: number;
  updated: number;
  total: number;
  last_id: number | null;
  done: boolean;
};

/**
 * Один батч пересчёта. Фронт зацикливается через `fromId = result.last_id`,
 * пока result.done === true. Размер батча — до 1000 (по умолчанию 500).
 */
export async function recomputeAdminPricingBatch(
  opts: { providerId?: number; categoryId?: number; fromId?: number | null; limit?: number } = {},
): Promise<PricingRecomputeBatch> {
  const body = {
    provider_id: opts.providerId ?? null,
    category_id: opts.categoryId ?? null,
    from_id: opts.fromId ?? null,
    limit: opts.limit ?? 500,
  };
  const r = await adminFetch<{ data: PricingRecomputeBatch }>(
    '/admin/pricing/recompute',
    { method: 'POST', body: JSON.stringify(body) },
  );
  return r.data;
}

export async function getAdminPricingRules(): Promise<AdminPricingRule[]> {
  const r = await adminFetch<{ data: AdminPricingRule[] }>('/admin/pricing');
  return r.data;
}

export async function createAdminPricingRule(data: Partial<AdminPricingRule>): Promise<void> {
  await adminFetch('/admin/pricing', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAdminPricingRule(id: number, data: Partial<AdminPricingRule>): Promise<void> {
  await adminFetch(`/admin/pricing/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteAdminPricingRule(id: number): Promise<void> {
  await adminFetch(`/admin/pricing/${id}`, { method: 'DELETE' });
}

// ---------- Настройки ----------
export type AdminSetting = {
  key: string;
  value: string | null;
  type: 'string' | 'int' | 'bool' | 'json';
  description: string | null;
};

export async function getAdminSettings(): Promise<AdminSetting[]> {
  const r = await adminFetch<{ data: AdminSetting[] }>('/admin/settings');
  return r.data;
}

export async function updateAdminSettings(settings: Array<{ key: string; value: string | null }>): Promise<void> {
  await adminFetch('/admin/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
}

// ---------- Каталог поставщика ----------
export type ProviderCatalogItem = {
  external_id: string;
  product_id: number | null;
  name: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  logo: string | null;
  price_in: number | null;
  currency: string | null;
  last_seen_at: string | null;
  in_stock: number | null;
};

export type ProviderCatalogMeta = Paginated<ProviderCatalogItem>['meta'] & {
  connected_count: number;
  unconnected_count: number;
};

export type ProviderCatalogResponse = {
  data: ProviderCatalogItem[];
  meta: ProviderCatalogMeta;
};

export type ProviderCatalogQuery = {
  filter?: 'connected' | 'unconnected' | 'all';
  q?: string;
  page?: number;
  per_page?: number;
};

export async function getProviderCatalog(
  providerId: number,
  query: ProviderCatalogQuery = {},
): Promise<ProviderCatalogResponse> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return adminFetch<ProviderCatalogResponse>(
    `/admin/providers/${providerId}/catalog${qs ? `?${qs}` : ''}`,
  );
}

export type ProviderCatalogItemDetail = {
  external_id: string;
  product_id: number | null;
  raw_meta: Record<string, unknown>;
  price_in: number | null;
  in_stock: number | null;
  last_seen_at: string | null;
  // Автоматическое предложение: наша категория, синканная из FK-категории товара.
  // null — соответствующая локальная категория ещё не создана (нужен providers:sync).
  suggested_category: {
    id: number;
    slug: string;
    name: string;
    parent_id: number | null;
  } | null;
};

export async function getProviderCatalogItem(
  providerId: number,
  externalId: string,
): Promise<ProviderCatalogItemDetail> {
  const r = await adminFetch<{ data: ProviderCatalogItemDetail }>(
    `/admin/providers/${providerId}/catalog/${encodeURIComponent(externalId)}`,
  );
  return r.data;
}

export async function connectProviderProduct(
  providerId: number,
  externalId: string,
  data: {
    category_id: number;
    name: string;
    short_description?: string | null;
    description?: string | null;
    price_base: number;
    markup_pct?: number | null;
    fulfillment_fallback?: 'manual' | 'none';
    required_params?: Array<{ name: string; label: string; type: string; required: boolean }> | null;
    status?: 'draft' | 'active';
  },
): Promise<{ product_id: number; product_slug: string }> {
  const r = await adminFetch<{ data: { product_id: number; product_slug: string } }>(
    `/admin/providers/${providerId}/catalog/${encodeURIComponent(externalId)}/connect`,
    { method: 'POST', body: JSON.stringify(data) },
  );
  return r.data;
}

export async function syncProviderCatalog(providerId: number): Promise<string> {
  const r = await adminFetch<{ data: { ok: boolean; output: string } }>(
    `/admin/providers/${providerId}/sync`,
    { method: 'POST' },
  );
  return r.data.output;
}

export type ConnectAllBatchResult = {
  total: number;
  processed: number;
  created: number;
  skipped: number;
  skipped_items: Array<{ external_id: string; name: string; reason: string }>;
  last_id: number | null;
  done: boolean;
};

/**
 * Один батч массового подключения. Возвращает что обработано + курсор для следующего вызова.
 * Размер батча можно регулировать (200 — безопасно для типичного таймаута nginx/CF).
 */
export async function connectAllProviderProductsBatch(
  providerId: number,
  opts: { status?: 'draft' | 'active'; limit?: number; fromId?: number | null } = {},
): Promise<ConnectAllBatchResult> {
  const body = {
    status: opts.status ?? 'draft',
    limit: opts.limit ?? 200,
    from_id: opts.fromId ?? null,
  };
  const r = await adminFetch<{ data: ConnectAllBatchResult }>(
    `/admin/providers/${providerId}/catalog/connect-all`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return r.data;
}

// ---------- Промокоды ----------
export type AdminPromocode = {
  id: number;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_total: number | null;
  max_discount: number | null;
  limit_total: number | null;
  limit_per_user: number | null;
  used_count: number;
  category_ids: number[] | null;
  product_ids: number[] | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  is_valid: boolean;
  created_at: string | null;
};

export type AdminPromocodeInput = Partial<{
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_total: number | null;
  max_discount: number | null;
  limit_total: number | null;
  limit_per_user: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}>;

export async function listAdminPromocodes(
  query: { q?: string; page?: number; per_page?: number } = {},
): Promise<Paginated<AdminPromocode>> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return adminFetch<Paginated<AdminPromocode>>(`/admin/promocodes${qs ? `?${qs}` : ''}`);
}

export async function getAdminPromocode(id: number): Promise<AdminPromocode> {
  const r = await adminFetch<{ data: AdminPromocode }>(`/admin/promocodes/${id}`);
  return r.data;
}

export async function createAdminPromocode(data: AdminPromocodeInput): Promise<AdminPromocode> {
  const r = await adminFetch<{ data: AdminPromocode }>('/admin/promocodes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.data;
}

export async function updateAdminPromocode(id: number, data: AdminPromocodeInput): Promise<AdminPromocode> {
  const r = await adminFetch<{ data: AdminPromocode }>(`/admin/promocodes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return r.data;
}

export async function deleteAdminPromocode(id: number): Promise<void> {
  await adminFetch(`/admin/promocodes/${id}`, { method: 'DELETE' });
}

// ---------- Дашборд ----------
export type DashboardStats = {
  period: string;
  revenue: number;
  orders: number;
  avg_check: number;
  margin: number;
  revenue_today: number;
  orders_today: number;
  products_total: number;
  by_status: Record<string, number>;
  chart: Array<{ date: string; revenue: number }>;
  top_products: Array<{ id: number; name: string; sales_count: number }>;
  low_stock: Array<{ id: number; name: string; stock: number }>;
  payment_methods: Array<{ method: string; orders: number; revenue: number }>;
};

export async function getDashboardStats(period = '30d'): Promise<DashboardStats> {
  const r = await adminFetch<{ data: DashboardStats }>(`/admin/dashboard?period=${encodeURIComponent(period)}`);
  return r.data;
}
