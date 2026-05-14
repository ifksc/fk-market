'use client';

import { useEffect, useState } from 'react';
import { getAdminSettings, updateAdminSettings, type AdminSetting } from '@/lib/admin';

const FRIENDLY_LABELS: Record<string, string> = {
  site_name: 'Название сайта',
  site_email: 'Email магазина',
  currency: 'Валюта',
  global_markup_pct: 'Глобальная наценка %',
  order_sla_minutes_manual: 'SLA ручной выдачи (мин)',
  payment_hold_minutes: 'Холд неоплаченного заказа (мин)',
};

// Ключи, для которых вместо текстового поля рендерим select с фиксированными значениями
const ENUM_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setLoading(true);
    getAdminSettings()
      .then((s) => {
        setSettings(s);
        setDraft(Object.fromEntries(s.map((row) => [row.key, row.value ?? ''])));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const changed = settings
        .filter((s) => (draft[s.key] ?? '') !== (s.value ?? ''))
        .map((s) => ({ key: s.key, value: draft[s.key] || null }));
      if (changed.length === 0) { setSaving(false); return; }
      await updateAdminSettings(changed);
      setSavedAt(new Date());
      setSettings((prev) => prev.map((s) => ((draft[s.key] ?? '') !== (s.value ?? '') ? { ...s, value: draft[s.key] || null } : s)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const dirty = settings.some((s) => (draft[s.key] ?? '') !== (s.value ?? ''));

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <h1 className="font-bold text-lg">Настройки</h1>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-emerald-600">сохранено в {savedAt.toLocaleTimeString('ru')}</span>}
          <button onClick={onSave} disabled={saving || !dirty}
            className="h-10 px-5 rounded-xl fk-grad-btn text-sm font-medium disabled:opacity-50">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </header>

      <div className="p-6 max-w-3xl space-y-4">
        {loading ? (
          <div className="text-sm text-slate-500">Загрузка…</div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            {settings.map((s) => (
              <div key={s.key}>
                <label className="block">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{FRIENDLY_LABELS[s.key] ?? s.key}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-500 font-mono uppercase">{s.type}</span>
                    <span className="text-xs text-slate-500 font-mono ml-auto">{s.key}</span>
                  </div>
                  {ENUM_OPTIONS[s.key] ? (
                    <select value={draft[s.key] ?? ''} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm">
                      {ENUM_OPTIONS[s.key].map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : s.type === 'bool' ? (
                    <select value={draft[s.key] ?? ''} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm">
                      <option value="1">Включено</option>
                      <option value="0">Выключено</option>
                    </select>
                  ) : s.type === 'json' ? (
                    <textarea value={draft[s.key] ?? ''} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} rows={4}
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono" />
                  ) : (
                    <input type={s.type === 'int' ? 'number' : 'text'} value={draft[s.key] ?? ''}
                      onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm" />
                  )}
                  {s.description && <div className="text-xs text-slate-500 mt-1">{s.description}</div>}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
