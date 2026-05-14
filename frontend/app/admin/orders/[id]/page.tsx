'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, RotateCcw, X } from 'lucide-react';
import { adminOrderAction, getAdminOrder, type AdminOrderDetail } from '@/lib/admin';

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setOrder(await getAdminOrder(id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const action = async (a: 'cancel' | 'refund' | 'redeliver' | 'refulfill', confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try {
      await adminOrderAction(id, a);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !order) return <div className="p-6 text-sm text-slate-500">Загрузка…</div>;
  if (!order) return <div className="p-6 text-sm text-red-500">{error ?? 'Не найдено'}</div>;

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-bold text-lg font-mono">{order.public_number}</h1>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex gap-2">
          {(order.status === 'paid' || order.status === 'completed') && (
            <button
              onClick={() => action('redeliver')}
              disabled={busy}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm flex items-center gap-1 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Отправить заново
            </button>
          )}
          {(order.status === 'paid' || order.status === 'fulfilling' || order.status === 'failed') && (
            <button
              onClick={() => action('refulfill', 'Запустить выдачу заново?')}
              disabled={busy}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm flex items-center gap-1 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Перезапустить выдачу
            </button>
          )}
          {!['completed', 'refunded', 'cancelled'].includes(order.status) && (
            <button
              onClick={() => action('cancel', 'Отменить заказ?')}
              disabled={busy}
              className="h-10 px-3 rounded-xl border border-red-300 dark:border-red-700 text-sm text-red-600 flex items-center gap-1 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Отменить
            </button>
          )}
          {(order.status === 'paid' || order.status === 'completed') && (
            <button
              onClick={() => action('refund', 'Пометить как возврат? (это только статус, реальный возврат денег не происходит)')}
              disabled={busy}
              className="h-10 px-3 rounded-xl border border-red-300 dark:border-red-700 text-sm text-red-600 disabled:opacity-50"
            >
              Возврат
            </button>
          )}
        </div>
      </header>

      <div className="p-6 grid lg:grid-cols-[1fr_360px] gap-6 max-w-7xl">
        <section className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="font-bold mb-4">Позиции заказа</div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {order.items.map((it) => (
                <div key={it.id} className="py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    {it.product_slug ? (
                      <Link href={`/admin/products/${it.product_id}`} className="font-medium hover:text-brand-600 flex-1 line-clamp-1">
                        {it.product_name}
                      </Link>
                    ) : (
                      <div className="font-medium flex-1 line-clamp-1">{it.product_name}</div>
                    )}
                    <div className="text-xs text-slate-500">
                      {it.qty} × {it.price.toLocaleString('ru')} ₽
                    </div>
                    <div className="font-semibold">{it.total.toLocaleString('ru')} ₽</div>
                    <FulfillmentStatus status={it.fulfillment_status} />
                  </div>
                  {it.params && Object.keys(it.params).length > 0 && (
                    <div className="text-xs text-slate-500 pl-2">
                      Параметры: {Object.entries(it.params).map(([k, v]) => `${k}=${v}`).join(', ')}
                    </div>
                  )}
                  {it.delivered_payload && (
                    <code className="block bg-slate-900 dark:bg-slate-950 text-slate-100 px-3 py-2 rounded-lg font-mono text-xs break-all">
                      {it.delivered_payload}
                    </code>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="font-bold mb-3">Платежи</div>
            {order.payments.length === 0 ? (
              <div className="text-sm text-slate-500">Платежи не найдены</div>
            ) : (
              <div className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                {order.payments.map((p) => (
                  <div key={p.id} className="py-2 flex items-center gap-3">
                    <span className="text-xs px-2 py-1 rounded-md bg-slate-500/10 text-slate-600">{p.provider}</span>
                    <span className="flex-1 text-slate-500">
                      {p.method ?? '—'} · {p.provider_payment_id ?? 'no id'}
                    </span>
                    <span className="font-semibold">{p.amount.toLocaleString('ru')} ₽</span>
                    <span
                      className={`text-xs px-2 py-1 rounded-md ${
                        p.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-slate-500/15 text-slate-500'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="font-bold mb-3">Покупатель</div>
            <Row label="Email" value={order.email} />
            <Row label="Телефон" value={order.phone ?? '—'} />
            {order.user && <Row label="ЛК" value={`#${order.user.id} ${order.user.email}`} />}
            <Row label="IP" value={order.ip ?? '—'} />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="font-bold mb-3">Финансы</div>
            <Row label="Сумма" value={`${order.subtotal.toLocaleString('ru')} ₽`} />
            <Row label="Скидка" value={`${order.discount.toLocaleString('ru')} ₽`} />
            <Row label="Итого" value={<b>{order.total.toLocaleString('ru')} ₽</b>} />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="font-bold mb-3">Таймстемпы</div>
            <Row label="Создан" value={fmt(order.created_at)} />
            <Row label="Оплачен" value={fmt(order.paid_at)} />
            <Row label="Завершён" value={fmt(order.completed_at)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminOrderDetail['status'] }) {
  const map: Record<AdminOrderDetail['status'], string> = {
    pending: 'bg-yellow-500/15 text-yellow-600',
    paid: 'bg-emerald-500/15 text-emerald-600',
    fulfilling: 'bg-blue-500/15 text-blue-600',
    completed: 'bg-emerald-500/15 text-emerald-600',
    failed: 'bg-red-500/15 text-red-600',
    refunded: 'bg-slate-500/15 text-slate-600',
    cancelled: 'bg-slate-500/15 text-slate-600',
  };
  const labels: Record<AdminOrderDetail['status'], string> = {
    pending: 'Ожидает оплаты',
    paid: 'Оплачен',
    fulfilling: 'Выдача',
    completed: 'Готов',
    failed: 'Ошибка',
    refunded: 'Возврат',
    cancelled: 'Отменён',
  };
  return <span className={`text-xs px-2 py-1 rounded-md font-medium ${map[status]}`}>{labels[status]}</span>;
}

function FulfillmentStatus({ status }: { status: AdminOrderDetail['items'][0]['fulfillment_status'] }) {
  const map = {
    pending: ['bg-slate-500/15 text-slate-500', 'pending'],
    queued: ['bg-yellow-500/15 text-yellow-600', 'в очереди'],
    in_progress: ['bg-blue-500/15 text-blue-600', 'обрабатывается'],
    delivered: ['bg-emerald-500/15 text-emerald-600', '✓ выдано'],
    failed: ['bg-red-500/15 text-red-600', 'ошибка'],
  } as const;
  const [cls, label] = map[status] ?? map.pending;
  return <span className={`text-xs px-2 py-1 rounded-md ${cls}`}>{label}</span>;
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru');
}
