'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Check, Copy, Loader2, ShoppingBag } from 'lucide-react';
import { getOrderStatus, type OrderStatus } from '@/lib/api';
import { useCart } from '@/lib/cart';

// Next.js 16 требует Suspense вокруг useSearchParams() для CSR-bailout.
// Оборачиваем здесь — на странице, чтобы билдер не падал.
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessPageSkeleton />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}

function SuccessPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-10 text-center">
        <Loader2 className="w-12 h-12 mx-auto text-brand-500 animate-spin mb-4" />
        <h1 className="text-2xl font-bold mb-2">Загружаем заказ…</h1>
      </div>
    </div>
  );
}

function CheckoutSuccessContent() {
  const sp = useSearchParams();
  const queryOrder = sp.get('order') ?? sp.get('MERCHANT_ORDER_ID') ?? null;
  const { clear } = useCart();

  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Берём номер заказа: из ?order=, либо из localStorage (его положили на /checkout)
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('fk-last-order') : null;
    setOrderNumber(queryOrder ?? stored);
  }, [queryOrder]);

  // Polling: ждём пока вебхук от FKwallet поменяет статус на paid
  useEffect(() => {
    if (!orderNumber) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // 20 × 2s = 40s

    const poll = async () => {
      attempts++;
      try {
        const result = await getOrderStatus(orderNumber);
        if (cancelled) return;

        setOrder(result);

        if (result.status === 'completed' || result.status === 'paid') {
          setLoading(false);
          clear(); // очищаем корзину после успеха
          localStorage.removeItem('fk-last-order');
          return;
        }

        if (result.status === 'failed' || result.status === 'cancelled') {
          setLoading(false);
          setError('Заказ был отменён');
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Не удалось получить статус заказа');
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [orderNumber, clear]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!orderNumber) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Не нашли номер заказа</h1>
        <p className="text-gray-500 mb-6">Откройте личный кабинет — все ваши заказы там.</p>
        <Link
          href="/account"
          className="inline-flex h-11 px-5 rounded-xl fk-grad-btn font-medium items-center"
        >
          В личный кабинет
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-10">
        {loading && !order && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto text-brand-500 animate-spin mb-4" />
            <h1 className="text-2xl font-bold mb-2">Подтверждаем оплату…</h1>
            <p className="text-gray-500">Заказ {orderNumber}. Это занимает 5–30 секунд.</p>
          </div>
        )}

        {order && (order.status === 'paid' || order.status === 'completed' || order.status === 'fulfilling') && (
          <>
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-accent-500/15 text-accent-600 flex items-center justify-center mb-6">
                <Check className="w-10 h-10" strokeWidth={3} />
              </div>
              <h1 className="text-3xl font-bold mb-2">Заказ оплачен</h1>
              <p className="text-gray-500 dark:text-slate-400">
                Номер заказа{' '}
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {order.public_number}
                </span>
                <br />
                Чек и коды отправили на <span className="font-semibold">{order.email}</span>
              </p>
            </div>

            <div className="space-y-3">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="border border-gray-200 dark:border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-sm">{item.product_name}</div>
                      <div className="text-xs text-gray-500">
                        {item.qty} шт · {item.price.toLocaleString('ru')} ₽
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-md font-medium ${
                        item.fulfillment_status === 'delivered'
                          ? 'bg-accent-500/15 text-accent-600'
                          : item.fulfillment_status === 'queued'
                          ? 'bg-yellow-500/15 text-yellow-600'
                          : item.fulfillment_status === 'failed'
                          ? 'bg-red-500/15 text-red-600'
                          : 'bg-gray-500/15 text-gray-600'
                      }`}
                    >
                      {item.fulfillment_status === 'delivered'
                        ? '✓ Выдано'
                        : item.fulfillment_status === 'queued'
                        ? 'В очереди (ручная выдача)'
                        : item.fulfillment_status === 'failed'
                        ? 'Ошибка — обратитесь в поддержку'
                        : item.fulfillment_status}
                    </span>
                  </div>
                  {item.fulfillment_status === 'delivered' && item.delivered_payload && (
                    <div className="mt-3 flex gap-2">
                      <code className="flex-1 bg-slate-900 dark:bg-slate-950 text-slate-100 px-3 py-2 rounded-lg font-mono text-sm break-all">
                        {item.delivered_payload}
                      </code>
                      <button
                        onClick={() => copyToClipboard(item.delivered_payload!, `item-${i}`)}
                        className="h-10 px-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm flex items-center gap-1"
                      >
                        {copied === `item-${i}` ? <Check className="w-4 h-4 text-accent-600" /> : <Copy className="w-4 h-4" />}
                        {copied === `item-${i}` ? 'Скопировано' : 'Копировать'}
                      </button>
                    </div>
                  )}
                  {item.fulfillment_status === 'queued' && (
                    <p className="text-xs text-gray-500 mt-2">
                      Этот товар выдаётся вручную администратором — придёт отдельным письмом в течение 4 часов.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link
                href="/account"
                className="h-11 px-5 rounded-xl fk-grad-btn font-medium flex items-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />В личный кабинет
              </Link>
              <Link
                href="/catalog"
                className="h-11 px-5 rounded-xl border border-gray-300 dark:border-slate-700 font-medium flex items-center hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Продолжить покупки
              </Link>
            </div>
          </>
        )}

        {order && order.status === 'pending' && !loading && (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Ожидаем подтверждение</h1>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              FKwallet ещё не прислал нам уведомление об оплате. Если вы оплатили — обновите страницу через минуту.
            </p>
            <button
              onClick={() => location.reload()}
              className="h-11 px-5 rounded-xl fk-grad-btn font-medium"
            >
              Обновить
            </button>
          </div>
        )}

        {error && (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Ошибка</h1>
            <p className="text-red-500 mb-6">{error}</p>
            <Link
              href="/account"
              className="inline-flex h-11 px-5 rounded-xl border border-gray-300 dark:border-slate-700 font-medium items-center"
            >
              В личный кабинет
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
