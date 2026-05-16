'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Copy, Mail, RefreshCw, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { AuthError } from '@/lib/auth';
import { getMyOrder, resendOrderEmail, type MyOrderDetail } from '@/lib/account';
import { ReviewForm } from '@/components/ReviewForm';

export default function OrderDetailPage() {
  const params = useParams<{ public_number: string }>();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [order, setOrder] = useState<MyOrderDetail | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [resending, setResending] = useState(false);
  const [resentNotice, setResentNotice] = useState<string | null>(null);
  const [openReview, setOpenReview] = useState<number | null>(null);
  const [reviewedNow, setReviewedNow] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?redirect=/account/orders/${params.public_number}`);
  }, [loading, user, router, params.public_number]);

  useEffect(() => {
    if (!user || !params.public_number) return;
    setOrderLoading(true);
    setError(null);
    getMyOrder(params.public_number)
      .then(setOrder)
      .catch((e) => {
        if (e instanceof AuthError) {
          if (e.status === 401) logout();
          else setError(e.message);
        } else setError('Не удалось загрузить заказ');
      })
      .finally(() => setOrderLoading(false));
  }, [user, params.public_number, logout]);

  const copy = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch { /* ignore */ }
  };

  const onResend = async () => {
    if (!order) return;
    setResending(true);
    setResentNotice(null);
    try {
      await resendOrderEmail(order.public_number);
      setResentNotice('Письмо отправлено повторно');
    } catch (e) {
      if (e instanceof AuthError) setResentNotice(e.message);
      else setResentNotice('Не удалось отправить');
    } finally {
      setResending(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Загрузка…</div>;
  }
  if (orderLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Загружаем заказ…</div>;
  }
  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 mb-4">{error || 'Заказ не найден'}</p>
        <Link href="/account/orders" className="text-brand-600 hover:underline">← К списку заказов</Link>
      </div>
    );
  }

  const meta = statusMeta(order.status);
  const date = order.created_at ? new Date(order.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/account/orders" className="text-sm text-gray-500 hover:text-brand-600">← К списку заказов</Link>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="text-sm text-gray-500 font-mono">{order.public_number}</div>
            <h1 className="text-2xl font-bold">Заказ от {date}</h1>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full ${meta.bg} ${meta.text}`}>{meta.label}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Field label="Сумма" value={`${order.total.toLocaleString('ru-RU')} ₽`} />
          <Field label="Email" value={order.email} />
          <Field label="Статус" value={meta.label} />
        </div>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 mb-4">
        <h2 className="text-lg font-semibold mb-4">Товары</h2>
        <div className="space-y-3">
          {order.items.map((it) => (
            <div key={it.id} className="border border-gray-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <Link
                  href={it.product ? `/products/${it.product.slug}` : '#'}
                  className="font-medium hover:text-brand-600"
                >
                  {it.product?.name ?? 'Товар удалён'}
                </Link>
                <div className="text-sm text-gray-500">{it.qty} × {it.price.toLocaleString('ru-RU')} ₽</div>
              </div>

              {it.fulfillment_status === 'delivered' && it.delivered_payload ? (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Выдан
                      {it.delivered_at && <span className="text-gray-500 font-normal"> · {new Date(it.delivered_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                    </span>
                    <button
                      onClick={() => copy(it.delivered_payload!, it.id)}
                      className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-700"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied === it.id ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>
                  <div className="font-mono text-sm break-all select-all">{it.delivered_payload}</div>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <Clock className="w-4 h-4" />
                  {fulfillmentLabel(it.fulfillment_status)}
                </div>
              )}

              {/* Отзыв на купленный товар */}
              {it.product && (it.reviewed || reviewedNow.has(it.id)) ? (
                <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Вы оставили отзыв — появится после проверки
                </div>
              ) : it.can_review && it.product ? (
                openReview === it.id ? (
                  <ReviewForm
                    productId={it.product.id}
                    onDone={() => {
                      setReviewedNow((s) => new Set(s).add(it.id));
                      setOpenReview(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenReview(it.id)}
                    className="mt-3 text-sm text-brand-600 hover:underline"
                  >
                    Оставить отзыв
                  </button>
                )
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {(order.status === 'paid' || order.status === 'completed') && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Mail className="w-4 h-4" /> Не пришло письмо с кодами?
          </div>
          <button
            onClick={onResend}
            disabled={resending}
            className="h-10 px-4 rounded-xl border border-gray-200 dark:border-slate-800 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Отправляем…' : 'Отправить ещё раз'}
          </button>
          {resentNotice && <span className="text-sm text-gray-500">{resentNotice}</span>}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}

function statusMeta(status: MyOrderDetail['status']) {
  switch (status) {
    case 'completed': return { label: 'Выдан', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' };
    case 'paid':      return { label: 'Оплачен', bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' };
    case 'pending':   return { label: 'Ожидает оплаты', bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' };
    case 'cancelled': return { label: 'Отменён', bg: 'bg-gray-500/15', text: 'text-gray-600' };
    case 'refunded':  return { label: 'Возврат', bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' };
    default:          return { label: status, bg: 'bg-gray-500/15', text: 'text-gray-600' };
  }
}

function fulfillmentLabel(status: string): string {
  switch (status) {
    case 'pending': return 'В очереди на выдачу';
    case 'in_progress': return 'Обрабатывается у поставщика';
    case 'queued': return 'Ручная выдача — придёт письмом в течение 4 часов';
    case 'failed': return 'Ошибка выдачи — мы уже разбираемся';
    default: return status;
  }
}
