'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { adminQueueAction, getAdminQueue, type QueueResponse, type QueueTask } from '@/lib/admin';

type Filter = 'open' | 'mine' | 'overdue' | 'done' | 'failed' | 'all';

const FILTER_LABEL: Record<Filter, string> = {
  open: 'Открытые',
  mine: 'На мне',
  overdue: 'Просрочено',
  done: 'Выполнены',
  failed: 'Ошибки',
  all: 'Все',
};

export default function AdminQueuePage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState<{ id: number; payload: string; comment: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getAdminQueue(filter));
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

  const claim = async (taskId: number) => {
    setBusyId(taskId);
    try {
      await adminQueueAction(taskId, 'claim');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusyId(null);
    }
  };

  const submitComplete = async () => {
    if (!completeForm) return;
    setBusyId(completeForm.id);
    try {
      await adminQueueAction(completeForm.id, 'complete', {
        result_payload: completeForm.payload || undefined,
        comment: completeForm.comment || undefined,
      });
      setCompleteForm(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (taskId: number) => {
    const reason = prompt('Причина отмены задачи:');
    if (reason === null) return;
    setBusyId(taskId);
    try {
      await adminQueueAction(taskId, 'cancel', { reason });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg">Очередь выдачи</h1>
          {data && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">
              {data.meta.open_count}
            </span>
          )}
          {data && data.meta.overdue_count > 0 && (
            <span className="text-xs text-red-500">просрочено: {data.meta.overdue_count}</span>
          )}
        </div>
        <button
          onClick={load}
          className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 h-9 rounded-lg text-sm ${
                filter === f
                  ? 'fk-grad-btn'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-500">{error}</div>
        ) : !data || data.data.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500">
            Задач в этой категории нет
          </div>
        ) : (
          <div className="space-y-3">
            {data.data.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                busy={busyId === t.id}
                completeForm={completeForm?.id === t.id ? completeForm : null}
                onClaim={() => claim(t.id)}
                onComplete={() => setCompleteForm({ id: t.id, payload: '', comment: '' })}
                onCancel={() => cancel(t.id)}
                onCompleteFormChange={setCompleteForm}
                onSubmitComplete={submitComplete}
                onCancelComplete={() => setCompleteForm(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  busy,
  completeForm,
  onClaim,
  onComplete,
  onCancel,
  onCompleteFormChange,
  onSubmitComplete,
  onCancelComplete,
}: {
  task: QueueTask;
  busy: boolean;
  completeForm: { id: number; payload: string; comment: string } | null;
  onClaim: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onCompleteFormChange: (f: { id: number; payload: string; comment: string }) => void;
  onSubmitComplete: () => void;
  onCancelComplete: () => void;
}) {
  const isWorking = task.status === 'in_progress';
  const border = task.is_overdue
    ? 'border-red-500/40'
    : isWorking
    ? 'border-brand-500/50 bg-brand-500/5'
    : 'border-slate-200 dark:border-slate-800';

  return (
    <div className={`bg-white dark:bg-slate-900 border ${border} rounded-2xl p-4`}>
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 flex-wrap">
            <span className="font-mono">#T-{task.id}</span>
            {task.order && (
              <Link href={`/admin/orders/${task.order.id}`} className="text-brand-600 hover:underline font-mono">
                {task.order.public_number}
              </Link>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                task.mode === 'manual' ? 'bg-purple-500/15 text-purple-500' : 'bg-blue-500/15 text-blue-500'
              }`}
            >
              {task.mode === 'manual' ? 'Ручная' : 'API'}
            </span>
            {task.is_overdue && <span className="text-red-500 font-semibold">Просрочено</span>}
          </div>
          <div className="font-semibold">{task.product?.name ?? `Order item #${task.order_item_id}`}</div>
          <div className="text-xs text-slate-500 mt-2 space-y-1">
            <div>Покупатель: <b className="text-slate-700 dark:text-slate-300">{task.order?.email}</b></div>
            {task.input_params && Object.keys(task.input_params).length > 0 && (
              <div>
                Параметры:{' '}
                {Object.entries(task.input_params).map(([k, v]) => (
                  <code key={k} className="font-mono mr-2">{k}={v}</code>
                ))}
              </div>
            )}
            {task.assignee && <div>В работе у: <b>{task.assignee.email}</b></div>}
            {task.error_text && <div className="text-red-500">⚠ {task.error_text}</div>}
          </div>

          {completeForm && (
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <input
                value={completeForm.payload}
                onChange={(e) => onCompleteFormChange({ ...completeForm, payload: e.target.value })}
                placeholder="Код / ключ для покупателя (если есть)"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-mono"
              />
              <textarea
                value={completeForm.comment}
                onChange={(e) => onCompleteFormChange({ ...completeForm, comment: e.target.value })}
                rows={2}
                placeholder="Комментарий (опционально)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
              />
              <div className="flex gap-2">
                <button onClick={onSubmitComplete} disabled={busy} className="h-9 px-4 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Подтвердить выдачу
                </button>
                <button onClick={onCancelComplete} className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="text-right text-xs">
          {task.deadline_at && (
            <div className={task.is_overdue ? 'text-red-500 font-semibold' : 'text-slate-500'}>
              SLA до: {new Date(task.deadline_at).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
      </div>
      {!completeForm && (task.status === 'queued' || task.status === 'in_progress') && (
        <div className="flex flex-wrap gap-2 mt-3">
          {task.status === 'queued' && (
            <button onClick={onClaim} disabled={busy} className="h-9 px-4 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-50">
              Взять в работу
            </button>
          )}
          <button onClick={onComplete} disabled={busy} className="h-9 px-4 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1">
            <Check className="w-4 h-4" />
            Выдать
          </button>
          {task.order && (
            <Link href={`/admin/orders/${task.order.id}`} className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm flex items-center">
              Открыть заказ
            </Link>
          )}
          <button onClick={onCancel} disabled={busy} className="h-9 px-4 rounded-lg border border-red-300 dark:border-red-700 text-sm text-red-600 disabled:opacity-50 flex items-center gap-1">
            <X className="w-4 h-4" />
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}
