'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type CartItem = {
  product_id: number;
  slug: string;
  name: string;
  price: number;
  qty: number;
  category?: string;
  image?: string | null;
  fulfillment_mode?: 'stock' | 'api' | 'manual';
  params?: Record<string, string>;
};

type CartState = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  total: number;
  hydrated: boolean;
};

const CartCtx = createContext<CartState | null>(null);
const STORAGE_KEY = 'fk-cart';

/**
 * Стабильный ключ строки корзины: товар + конкретный набор params (вариант,
 * номинал, поля). Разные варианты одного товара = разные строки — иначе
 * «50 звёзд» и «75 звёзд» схлопывались в одну позицию с ценой первого ×2.
 */
export function cartLineKey(item: Pick<CartItem, 'product_id' | 'params'>): string {
  const p = item.params ?? {};
  const sig = Object.keys(p)
    .sort()
    .map((k) => `${k}=${p[k]}`)
    .join('&');
  return `${item.product_id}|${sig}`;
}

/** Проверка формы записи корзины из localStorage — защита от битых данных. */
function isValidCartItem(x: unknown): x is CartItem {
  if (typeof x !== 'object' || x === null) return false;
  const i = x as Record<string, unknown>;
  return (
    typeof i.product_id === 'number' &&
    typeof i.slug === 'string' &&
    typeof i.name === 'string' &&
    typeof i.price === 'number' &&
    typeof i.qty === 'number'
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(parsed.filter(isValidCartItem));
        }
      }
    } catch {
      // битый localStorage — начинаем с пустой корзины
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = (item: CartItem) => {
    setItems((prev) => {
      // Мерджим только при полном совпадении товара И варианта (cartLineKey).
      const key = cartLineKey(item);
      const existing = prev.find((p) => cartLineKey(p) === key);
      if (existing) {
        return prev.map((p) =>
          cartLineKey(p) === key ? { ...p, qty: p.qty + item.qty } : p,
        );
      }
      return [...prev, item];
    });
  };

  const remove = (key: string) =>
    setItems((prev) => prev.filter((p) => cartLineKey(p) !== key));

  const setQty = (key: string, qty: number) =>
    setItems((prev) =>
      prev.map((p) => (cartLineKey(p) === key ? { ...p, qty: Math.max(1, qty) } : p)),
    );

  const clear = () => setItems([]);

  const count = items.reduce((s, p) => s + p.qty, 0);
  const total = items.reduce((s, p) => s + p.price * p.qty, 0);

  return (
    <CartCtx.Provider value={{ items, add, remove, setQty, clear, count, total, hydrated }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
