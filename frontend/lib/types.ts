// FK.market — типы ответов API

export type Category = {
  id: number;
  slug: string;
  legacy_slug: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  parent_id: number | null;
  show_in_header: boolean;
  is_new: boolean;
  products_count: number;
  // ISO-дата последнего изменения — для <lastmod> в sitemap.xml.
  updated_at: string | null;
};

export type ProductCategory = {
  slug: string;
  name: string;
  icon: string | null;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  // archived/draft товар остаётся видимым, но непокупаемым.
  status: 'active' | 'draft' | 'archived';
  short_description: string | null;
  price: number;
  price_old: number | null;
  discount_pct: number;
  currency: string;
  rating: number;
  reviews_count: number;
  sales_count: number;
  stock_available: number | null;
  fulfillment_mode: 'stock' | 'api' | 'manual';
  category: ProductCategory | null;
  image: string | null;
  images: string[];
  // ISO-дата последнего изменения — для <lastmod> в sitemap.xml.
  updated_at: string | null;
};

// Базовое поле параметра товара. Для variant_select — заполняется variants[].
// type=variant_select означает: внутри одной карточки лежит несколько внешних SKU
// (например, регионы выдачи Steam-кода). Выбор пользователя меняет цену и определяет,
// какой external_id отдадим поставщику при выдаче.
export type ProductParam = {
  name: string;
  label: string;
  // 'string' | 'email' | 'url' | 'select' | 'variant_select' | 'steam_login' | 'amount_input'
  type: string;
  required: boolean;
  hint?: string;
  options?: string[]; // для type='select'
  variants?: Array<{
    label: string;
    external_id: string;
    price: number;
    image?: string | null;
  }>;
  // amount_input
  min?: number;
  max?: number;
  fee_pct?: number;
  payment_system_id?: number;
};

export type ProductDetail = Product & {
  description: string | null;
  required_params: ProductParam[] | null;
  reviews: Array<{
    id: number;
    rating: number;
    text: string | null;
    author: string;
    created_at: string | null;
  }>;
  faq: Array<{
    id: number;
    question: string;
    answer: string;
  }>;
  related: Product[];
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

export type ApiResponse<T> = {
  data: T;
};

// ---------- Блог ----------
export type BlogFaqItem = {
  question: string;
  answer: string;
};

/** Карточка статьи в списке /blog — без тяжёлого content. */
export type BlogPostCard = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  author: string | null;
  tags: string[];
  published_at: string | null;
  updated_at: string | null;
};

/** Полная статья — страница /blog/[slug]. */
export type BlogPostFull = BlogPostCard & {
  meta_description: string | null;
  content: string | null;
  related_products: string[];
  related_posts: string[];
  faq: BlogFaqItem[];
  updated_at: string | null;
};
