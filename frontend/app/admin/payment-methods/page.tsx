'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CreditCard, Plus, Save, Trash2 } from 'lucide-react';
import {
  createAdminPaymentMethod,
  deleteAdminPaymentMethod,
  listAdminPaymentMethods,
  reorderAdminPaymentMethods,
  updateAdminPaymentMethod,
  type AdminPaymentMethod,
  type AdminPaymentMethodInput,
} from '@/lib/admin';

export default function AdminPaymentMethodsPage() {
  const [items, setItems] = useState<AdminPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listAdminPaymentMethods());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleEnabled = async (m: AdminPaymentMethod) => {
    setBusy(true);
    try {
      await updateAdminPaymentMethod(m.id, { is_enabled: !m.is_enabled });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setItems(next);
    setBusy(true);
    try {
      await reorderAdminPaymentMethods(next.map((m) => m.id));
    } finally {
      setBusy(false);
    }
  };

  const onSaveRow = async (m: AdminPaymentMethod, patch: AdminPaymentMethodInput) => {
    setBusy(true);
    try {
      const updated = await updateAdminPaymentMethod(m.id, patch);
      setItems((arr) => arr.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (m: AdminPaymentMethod) => {
    if (!confirm(`Удалить метод «${m.name}»?`)) return;
    setBusy(true);
    try {
      await deleteAdminPaymentMethod(m.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const addNew = async () => {
    const code = prompt('Код метода (latin, без пробелов):');
    if (!code) return;
    const name = prompt('Название?', code) ?? code;
    setBusy(true);
    try {
      await createAdminPaymentMethod({ code, name, is_enabled: true, sort_order: 999 });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-slate-500" />
          <h1 className="font-bold text-lg">Способы оплаты</h1>
        </div>
        <button
          onClick={addNew}
          disabled={busy}
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Добавить метод
        </button>
      </header>

      <div className="p-6 max-w-5xl space-y-3">
        {loading && items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500">
            Методы оплаты ещё не созданы. Выполни <code>php artisan payment-methods:seed</code> на сервере.
          </div>
        ) : (
          items.map((m, idx) => (
            <MethodRow
              key={m.id}
              method={m}
              busy={busy}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              onToggle={() => toggleEnabled(m)}
              onUp={() => move(idx, -1)}
              onDown={() => move(idx, 1)}
              onSave={(patch) => onSaveRow(m, patch)}
              onDelete={() => onDelete(m)}
            />
          ))
        )}

        <div className="bg-brand-50 dark:bg-slate-900 border border-brand-500/30 rounded-2xl p-4 text-xs text-slate-600 dark:text-slate-300">
          <b>FK i</b> — это «payment_system_id» (<code>i=N</code>) у FreeKassa: код метода в их системе. Если оставить пустым,
          FK откроет общую страницу оплаты, где пользователь выберет сам.
        </div>
      </div>
    </div>
  );
}

function MethodRow({
  method,
  busy,
  isFirst,
  isLast,
  onToggle,
  onUp,
  onDown,
  onSave,
  onDelete,
}: {
  method: AdminPaymentMethod;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
  onSave: (patch: AdminPaymentMethodInput) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<AdminPaymentMethod>(method);
  useEffect(() => setDraft(method), [method]);

  const dirty =
    draft.name !== method.name ||
    draft.description !== method.description ||
    draft.icon !== method.icon ||
    draft.fk_id !== method.fk_id ||
    draft.integration_mode !== method.integration_mode ||
    draft.min_amount !== method.min_amount ||
    draft.max_amount !== method.max_amount ||
    draft.extra_fee_pct !== method.extra_fee_pct;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex flex-col gap-0.5">
          <button disabled={isFirst || busy} onClick={onUp} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button disabled={isLast || busy} onClick={onDown} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">{method.name}</span>
            <code className="text-xs font-mono text-slate-500">{method.code}</code>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 uppercase font-mono">{method.integration_mode}</span>
            {!method.is_enabled && <span className="text-xs px-2 py-0.5 rounded bg-slate-500/15 text-slate-500">выключен</span>}
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={method.is_enabled} onChange={onToggle} disabled={busy} className="sr-only peer" />
          <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-500 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
        </label>
        <button onClick={onDelete} disabled={busy} className="text-red-500 hover:text-red-700 p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <Field label="Название">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" />
        </Field>
        <Field label="Подпись (под названием)">
          <input value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" />
        </Field>
        <Field label="Иконка (Lucide name)">
          <input value={draft.icon ?? ''} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="credit-card / qr-code / wallet…" className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-sm" />
        </Field>
        <Field label="FK i (id метода в Freekassa)">
          <input type="number" value={draft.fk_id ?? ''} onChange={(e) => setDraft({ ...draft, fk_id: e.target.value === '' ? null : Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" />
        </Field>
        <Field label="Режим интеграции">
          <select
            value={draft.integration_mode}
            onChange={(e) => setDraft({ ...draft, integration_mode: e.target.value as 'sci' | 'api' })}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
          >
            <option value="sci">SCI (форма pay.fk.money)</option>
            <option value="api">API (api.fk.life)</option>
          </select>
        </Field>
        <Field label="Мин. сумма, ₽">
          <input type="number" step="0.01" value={draft.min_amount ?? ''} onChange={(e) => setDraft({ ...draft, min_amount: e.target.value === '' ? null : Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" />
        </Field>
        <Field label="Макс. сумма, ₽">
          <input type="number" step="0.01" value={draft.max_amount ?? ''} onChange={(e) => setDraft({ ...draft, max_amount: e.target.value === '' ? null : Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" />
        </Field>
        <Field label="Доп. комиссия %">
          <input type="number" step="0.01" value={draft.extra_fee_pct} onChange={(e) => setDraft({ ...draft, extra_fee_pct: Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" />
        </Field>
      </div>

      {dirty && (
        <button
          onClick={() => onSave({
            name: draft.name,
            description: draft.description,
            icon: draft.icon,
            fk_id: draft.fk_id,
            integration_mode: draft.integration_mode,
            min_amount: draft.min_amount,
            max_amount: draft.max_amount,
            extra_fee_pct: draft.extra_fee_pct,
          })}
          disabled={busy}
          className="mt-3 h-9 px-4 rounded-lg fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Сохранить
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
