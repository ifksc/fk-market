'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AuthError } from '@/lib/auth';
import { createGuestTicket } from '@/lib/api';
import {
  createTicket,
  listMyOrders,
  listMyTickets,
  type MyOrderSummary,
  type SupportTicket,
} from '@/lib/account';

const KIND_LABEL: Record<SupportTicket['kind'], string> = {
  code_not_working: 'Код не работает',
  wrong_item: 'Пришёл не тот товар',
  other: 'Другой вопрос',
};

const STATUS_META: Record<SupportTicket['status'], { label: string; cls: string }> = {
  open: { label: 'Открыт', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  in_progress: { label: 'В работе', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  resolved: { label: 'Решён', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  rejected: { label: 'Отклонён', cls: 'bg-slate-500/15 text-slate-500' },
};

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <SupportInner />
    </Suspense>
  );
}

function SupportInner() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const orderParam = searchParams.get('order') ?? '';

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [orders, setOrders] = useState<MyOrderSummary[]>([]);

  const [kind, setKind] = useState<SupportTicket['kind']>('other');
  const [order, setOrder] = useState(orderParam);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    listMyTickets().then(setTickets).catch(() => {});
    listMyOrders({ page: 1 }).then((r) => setOrders(r.data)).catch(() => {});
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError('Заполните тему и сообщение');
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await createTicket({
        kind,
        subject: subject.trim(),
        body: body.trim(),
        order: order || undefined,
      });
      setTickets((t) => [ticket, ...t]);
      setSubject('');
      setBody('');
      setKind('other');
      setOrder('');
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Не удалось отправить обращение');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center text-gray-500">Загрузка…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Поддержка</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 mb-6">
        Вопрос или проблема с заказом — опишите, ответим в течение рабочего дня.
      </p>

      {!user ? (
        <GuestSupportForm />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Форма */}
          <form
            onSubmit={submit}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6"
          >
            <div className="font-bold mb-4">Новое обращение</div>

            <label className="text-xs text-gray-500 mb-1 block">Тип обращения</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SupportTicket['kind'])}
              className="w-full h-11 px-3 mb-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="code_not_working">Код не работает</option>
              <option value="wrong_item">Пришёл не тот товар</option>
              <option value="other">Другой вопрос</option>
            </select>

            <label className="text-xs text-gray-500 mb-1 block">Заказ (необязательно)</label>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="w-full h-11 px-3 mb-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">— не привязывать —</option>
              {orders.map((o) => (
                <option key={o.public_number} value={o.public_number}>
                  {o.public_number}
                  {o.items_summary[0]?.product_name ? ` · ${o.items_summary[0].product_name}` : ''}
                </option>
              ))}
            </select>

            <label className="text-xs text-gray-500 mb-1 block">Тема</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="Кратко о проблеме"
              className="w-full h-11 px-3 mb-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
            />

            <label className="text-xs text-gray-500 mb-1 block">Сообщение</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              placeholder="Опишите подробно: что произошло, что ожидали…"
              className="w-full h-28 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm resize-none"
            />

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            {done && <p className="text-sm text-emerald-600 mt-2">Обращение отправлено — ответим на email.</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-50"
            >
              {submitting ? 'Отправляем…' : 'Отправить обращение'}
            </button>
          </form>

          {/* Мои обращения */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="font-bold mb-4">Мои обращения</div>
            {tickets.length === 0 ? (
              <p className="text-sm text-gray-400">Обращений пока нет.</p>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => {
                  const st = STATUS_META[t.status];
                  return (
                    <div
                      key={t.id}
                      className="border border-gray-200 dark:border-slate-800 rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm">{t.subject}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0 ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {KIND_LABEL[t.kind]}
                        {t.order_number ? ` · заказ ${t.order_number}` : ''}
                        {t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString('ru')}` : ''}
                      </div>
                      {t.admin_note && (
                        <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                          Ответ поддержки: {t.admin_note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Гостевая форма обращения — по номеру заказа + email, без аккаунта. */
function GuestSupportForm() {
  const searchParams = useSearchParams();
  const [publicNumber, setPublicNumber] = useState(searchParams.get('order') ?? '');
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<SupportTicket['kind']>('other');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!publicNumber.trim() || !email.trim() || !subject.trim() || !body.trim()) {
      setError('Заполните все поля');
      return;
    }
    setSubmitting(true);
    try {
      await createGuestTicket({
        public_number: publicNumber.trim(),
        email: email.trim(),
        kind,
        subject: subject.trim(),
        body: body.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить обращение');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 max-w-md">
        <div className="font-bold text-lg mb-2">Обращение отправлено</div>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Ответим на email, указанный в заказе. Спасибо за обращение.
        </p>
      </div>
    );
  }

  const inputCls =
    'w-full h-11 px-3 mb-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm';

  return (
    <div className="max-w-md">
      <form
        onSubmit={submit}
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6"
      >
        <div className="font-bold mb-1">Обращение по заказу</div>
        <p className="text-xs text-gray-500 mb-4">
          Укажите номер заказа и email, на который он был оформлен.
        </p>

        <label className="text-xs text-gray-500 mb-1 block">Номер заказа</label>
        <input
          value={publicNumber}
          onChange={(e) => setPublicNumber(e.target.value)}
          placeholder="FK-2026-XXXXX"
          className={`${inputCls} font-mono`}
        />

        <label className="text-xs text-gray-500 mb-1 block">Email из заказа</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputCls}
        />

        <label className="text-xs text-gray-500 mb-1 block">Тип обращения</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as SupportTicket['kind'])}
          className={inputCls}
        >
          <option value="code_not_working">Код не работает</option>
          <option value="wrong_item">Пришёл не тот товар</option>
          <option value="other">Другой вопрос</option>
        </select>

        <label className="text-xs text-gray-500 mb-1 block">Тема</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="Кратко о проблеме"
          className={inputCls}
        />

        <label className="text-xs text-gray-500 mb-1 block">Сообщение</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          placeholder="Опишите подробно: что произошло, что ожидали…"
          className="w-full h-28 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm resize-none"
        />

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-50"
        >
          {submitting ? 'Отправляем…' : 'Отправить обращение'}
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-3 text-center">
        Есть аккаунт?{' '}
        <Link href="/login?redirect=/support" className="text-brand-600 hover:underline">
          Войдите
        </Link>{' '}
        — увидите историю обращений.
      </p>
    </div>
  );
}
