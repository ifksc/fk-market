'use client';

import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { listAdminTickets, updateAdminTicket, type AdminSupportTicket } from '@/lib/admin';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'open', label: 'Открытые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'resolved', label: 'Решённые' },
  { value: 'all', label: 'Все' },
];

const KIND_LABEL: Record<string, string> = {
  code_not_working: 'Код не работает',
  wrong_item: 'Не тот товар',
  other: 'Другой вопрос',
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: 'Открыт', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  in_progress: { label: 'В работе', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  resolved: { label: 'Решён', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  rejected: { label: 'Отклонён', cls: 'bg-slate-500/15 text-slate-500' },
};

export default function AdminSupportPage() {
  const [items, setItems] = useState<AdminSupportTicket[]>([]);
  const [openTotal, setOpenTotal] = useState<number | null>(null);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listAdminTickets({ status: filter, per_page: 100 });
      setItems(res.data);
      setOpenTotal(res.meta.open_total ?? null);
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
  }, [filter]);

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-6 sticky top-0 z-30">
        <Mail className="w-5 h-5 text-slate-500" />
        <h1 className="font-bold text-lg">Поддержка</h1>
        {openTotal != null && openTotal > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
            активных: {openTotal}
          </span>
        )}
      </header>

      <div className="p-6 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs w-fit">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 h-8 rounded-lg ${
                  filter === f.value ? 'bg-white dark:bg-slate-900 shadow-sm font-medium' : 'text-slate-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-500">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Обращений нет</div>
        ) : (
          <div className="space-y-3">
            {items.map((t) => (
              <TicketCard key={t.id} ticket={t} onSaved={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketCard({ ticket, onSaved }: { ticket: AdminSupportTicket; onSaved: () => void }) {
  const [status, setStatus] = useState(ticket.status);
  const [note, setNote] = useState(ticket.admin_note ?? '');
  const [saving, setSaving] = useState(false);
  const st = STATUS_META[ticket.status] ?? { label: ticket.status, cls: 'bg-slate-500/15 text-slate-500' };
  const dirty = status !== ticket.status || note !== (ticket.admin_note ?? '');

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminTicket(ticket.id, { status, admin_note: note || null });
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-semibold">{ticket.subject}</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0 ${st.cls}`}>
          {st.label}
        </span>
      </div>
      <div className="text-xs text-slate-400 mb-3">
        {KIND_LABEL[ticket.kind] ?? ticket.kind}
        {ticket.order_number ? ` · заказ ${ticket.order_number}` : ''}
        {ticket.user
          ? ` · ${ticket.user.name ?? 'без имени'} (${ticket.user.email})`
          : ticket.contact_email
            ? ` · гость (${ticket.contact_email})`
            : ''}
        {ticket.created_at ? ` · ${new Date(ticket.created_at).toLocaleString('ru')}` : ''}
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line mb-4">{ticket.body}</p>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="sm:w-44">
          <label className="text-xs text-slate-500 mb-1 block">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminSupportTicket['status'])}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          >
            <option value="open">Открыт</option>
            <option value="in_progress">В работе</option>
            <option value="resolved">Решён</option>
            <option value="rejected">Отклонён</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Ответ / заметка (видна покупателю)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={5000}
            className="w-full h-10 min-h-10 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="h-10 px-4 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
