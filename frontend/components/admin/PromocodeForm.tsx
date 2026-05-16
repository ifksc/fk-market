'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import {
  createAdminPromocode,
  updateAdminPromocode,
  type AdminPromocode,
  type AdminPromocodeInput,
} from '@/lib/admin';

type Props = {
  initial: AdminPromocode | null; // null = создание
};

/** ISO-строка → YYYY-MM-DD для <input type="date">. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

/** Пустая строка → null; иначе число. */
function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}

export function PromocodeForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;

  const [code, setCode] = useState(initial?.code ?? '');
  const [type, setType] = useState<'percent' | 'fixed'>(initial?.type ?? 'percent');
  const [value, setValue] = useState(String(initial?.value ?? ''));
  const [minTotal, setMinTotal] = useState(initial?.min_total != null ? String(initial.min_total) : '');
  const [maxDiscount, setMaxDiscount] = useState(initial?.max_discount != null ? String(initial.max_discount) : '');
  const [limitTotal, setLimitTotal] = useState(initial?.limit_total != null ? String(initial.limit_total) : '');
  const [limitPerUser, setLimitPerUser] = useState(initial?.limit_per_user != null ? String(initial.limit_per_user) : '');
  const [validFrom, setValidFrom] = useState(toDateInput(initial?.valid_from ?? null));
  const [validUntil, setValidUntil] = useState(toDateInput(initial?.valid_until ?? null));
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('Укажите код промокода');
      return;
    }
    if (numOrNull(value) === null || numOrNull(value)! < 0) {
      setError('Укажите корректное значение скидки');
      return;
    }

    setSubmitting(true);
    try {
      const payload: AdminPromocodeInput = {
        code: code.trim().toUpperCase(),
        type,
        value: numOrNull(value) ?? 0,
        min_total: numOrNull(minTotal),
        max_discount: type === 'percent' ? numOrNull(maxDiscount) : null,
        limit_total: numOrNull(limitTotal),
        limit_per_user: numOrNull(limitPerUser),
        valid_from: validFrom || null,
        valid_until: validUntil || null,
        is_active: isActive,
      };

      if (isEdit && initial) {
        await updateAdminPromocode(initial.id, payload);
      } else {
        await createAdminPromocode(payload);
      }
      router.push('/admin/promocodes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить промокод');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm';
  const labelCls = 'text-xs text-slate-500 mb-1 block';

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/admin/promocodes" className="text-slate-500 hover:text-brand-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-lg">
            {isEdit ? `Промокод ${initial?.code}` : 'Новый промокод'}
          </h1>
        </div>
        <button
          type="submit"
          form="promocode-form"
          disabled={submitting}
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {submitting ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </header>

      <form id="promocode-form" onSubmit={onSubmit} className="p-6 max-w-2xl space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className={labelCls}>Код *</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SALE15"
              className={`${inputCls} font-mono uppercase`}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Тип скидки *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'percent' | 'fixed')}
                className={inputCls}
              >
                <option value="percent">Процент (%)</option>
                <option value="fixed">Фиксированная (₽)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Значение * {type === 'percent' ? '(%)' : '(₽)'}
              </label>
              <input
                type="number"
                min={0}
                step={type === 'percent' ? 1 : 10}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Мин. сумма заказа (₽)</label>
              <input
                type="number"
                min={0}
                value={minTotal}
                onChange={(e) => setMinTotal(e.target.value)}
                placeholder="без ограничения"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Макс. скидка (₽)</label>
              <input
                type="number"
                min={0}
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder={type === 'percent' ? 'потолок скидки' : 'не применимо'}
                disabled={type !== 'percent'}
                className={`${inputCls} disabled:opacity-50`}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Лимит использований (всего)</label>
              <input
                type="number"
                min={1}
                value={limitTotal}
                onChange={(e) => setLimitTotal(e.target.value)}
                placeholder="без лимита"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Лимит на пользователя</label>
              <input
                type="number"
                min={1}
                value={limitPerUser}
                onChange={(e) => setLimitPerUser(e.target.value)}
                placeholder="без лимита"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Действует с</label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Действует до</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-brand-500"
            />
            Активен
          </label>

          {isEdit && (
            <p className="text-xs text-slate-500">
              Использован раз: <b>{initial?.used_count ?? 0}</b>
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
