'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getAdminProviderSyncRuns,
  getAdminProviders,
  updateAdminProvider,
  type AdminProvider,
  type ProviderSettings,
  type ProviderSyncRun,
} from '@/lib/admin';

const STATUS_TONE: Record<AdminProvider['status'], string> = {
  ok: 'bg-emerald-500/15 text-emerald-600',
  degraded: 'bg-yellow-500/15 text-yellow-600',
  error: 'bg-red-500/15 text-red-600',
  disabled: 'bg-slate-500/15 text-slate-500',
};

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; credentials: string; base_url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setProviders(await getAdminProviders());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (p: AdminProvider) => {
    setBusy(true);
    try {
      await updateAdminProvider(p.id, { is_enabled: !p.is_enabled });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateAdminProvider(editing.id, {
        name: editing.name,
        base_url: editing.base_url || null,
        credentials: editing.credentials || null,
      });
      setEditing(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 sticky top-0 z-30">
        <h1 className="font-bold text-lg">API-поставщики</h1>
      </header>

      <div className="p-6 space-y-4">
        {loading && providers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-500">{error}</div>
        ) : providers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500">
            Поставщиков ещё нет.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {providers.map((p) => {
              const isEditing = editing?.id === p.id;
              return (
                <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg fk-grad-btn flex items-center justify-center text-white font-bold text-xs">
                      {p.code.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{p.name}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_TONE[p.status]}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{p.code}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={p.is_enabled} onChange={() => toggle(p)} disabled={busy} className="sr-only peer" />
                      <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-500 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                    <div>
                      <div className="text-slate-500">Товаров</div>
                      <div className="font-semibold">{p.products_count}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Last sync</div>
                      <div className="font-semibold">{p.last_sync_at ? new Date(p.last_sync_at).toLocaleString('ru', { dateStyle: 'short' }) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Креды</div>
                      <div className="font-semibold">{p.has_credentials ? '✓' : '—'}</div>
                    </div>
                  </div>

                  {p.last_error_text && <div className="mt-3 text-xs text-red-500 break-all">⚠ {p.last_error_text}</div>}

                  {!isEditing ? (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Link
                          href={`/admin/providers/${p.id}/catalog`}
                          className="h-9 rounded-lg fk-grad-btn text-sm font-medium flex items-center justify-center"
                        >
                          Каталог →
                        </Link>
                        <button
                          onClick={() => setEditing({ id: p.id, credentials: '', base_url: p.base_url ?? '', name: p.name })}
                          className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                        >
                          Настроить
                        </button>
                      </div>

                      <AutoSyncSettings
                        provider={p}
                        onSaved={load}
                      />
                      <SyncHistory providerId={p.id} />
                    </>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Название" className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm" />
                      <input value={editing.base_url} onChange={(e) => setEditing({ ...editing, base_url: e.target.value })} placeholder="Base URL" className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm" />
                      <input value={editing.credentials} onChange={(e) => setEditing({ ...editing, credentials: e.target.value })} placeholder={p.has_credentials ? '••••• (оставь пустым)' : 'API-ключ'} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono" />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={busy} className="h-9 px-4 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-50">
                          Сохранить
                        </button>
                        <button onClick={() => setEditing(null)} className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-brand-50 dark:bg-slate-900 border border-brand-500/30 rounded-2xl p-5 text-sm text-slate-600 dark:text-slate-300">
          <b>Подсказка:</b> по кнопке «Каталог →» можно увидеть товары поставщика, синхронизировать их и подключить к
          нашему каталогу. Если поставщика fkwallet ещё нет в списке — создай его через POST /api/admin/providers
          с code=<code>fkwallet</code>, name=<code>FKwallet Online Products</code>.
        </div>
      </div>
    </div>
  );
}

function SyncHistory({ providerId }: { providerId: number }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<ProviderSyncRun[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRuns(await getAdminProviderSyncRuns(providerId, 10));
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && runs.length === 0) load();
  };

  const fmtTime = (s: string | null) => {
    if (!s) return '—';
    return new Date(s).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1"
        >
          <span>История синхронизаций</span>
          <span>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <button onClick={load} disabled={loading} className="text-xs text-brand-600 hover:underline disabled:opacity-50">
            {loading ? '…' : 'Обновить'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {loading && runs.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">Загрузка…</div>
          ) : runs.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">Запусков ещё не было</div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {runs.map((r) => {
                const tone = r.status === 'ok'
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : r.status === 'error'
                  ? 'bg-red-500/15 text-red-600'
                  : 'bg-amber-500/15 text-amber-600';
                const triggerLabel = { cron: 'cron', manual: 'руками', api: 'API' }[r.trigger];
                return (
                  <div key={r.id} className="text-xs bg-slate-50 dark:bg-slate-950 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${tone}`}>{r.status}</span>
                      <span className="text-slate-500">{triggerLabel}</span>
                      <span className="font-mono">{fmtTime(r.started_at)}</span>
                      {r.duration_sec !== null && <span className="text-slate-500">· {r.duration_sec}s</span>}
                    </div>
                    {r.status === 'error' && r.error_text && (
                      <div className="mt-1 text-red-500 break-all">{r.error_text}</div>
                    )}
                    {r.status === 'ok' && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                        <span>категорий: <b>{r.categories_synced}</b></span>
                        <span>добавлено: <b>{r.products_added}</b></span>
                        <span>обновлено: <b>{r.products_updated}</b></span>
                        {r.refresh_updated > 0 && <span>цен: <b>{r.refresh_updated}</b></span>}
                        {r.refresh_hidden > 0 && <span className="text-red-600">скрыто: <b>{r.refresh_hidden}</b></span>}
                        {r.refresh_restored > 0 && <span className="text-emerald-600">восстановлено: <b>{r.refresh_restored}</b></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AutoSyncSettings({ provider, onSaved }: { provider: AdminProvider; onSaved: () => void | Promise<void> }) {
  const initial: ProviderSettings = provider.settings ?? {};
  const [open, setOpen] = useState(false);
  const [autoSync, setAutoSync] = useState<boolean>(initial.auto_sync_enabled ?? false);
  const [interval, setInterval] = useState<number>(initial.auto_sync_interval_minutes ?? 60);
  const [updatePrices, setUpdatePrices] = useState<boolean>(initial.auto_update_prices ?? true);
  const [hideMissing, setHideMissing] = useState<boolean>(initial.auto_hide_missing ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminProvider(provider.id, {
        settings: {
          ...(provider.settings ?? {}),
          auto_sync_enabled: autoSync,
          auto_sync_interval_minutes: Math.max(5, interval || 60),
          auto_update_prices: updatePrices,
          auto_hide_missing: hideMissing,
        },
      });
      await onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-between"
      >
        <span>Авто-синхронизация {autoSync ? '· включена' : '· выключена'}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} className="w-4 h-4 rounded" />
            Запускать sync автоматически
          </label>

          <div className="flex items-center gap-2 pl-6 text-xs text-slate-500">
            <span>каждые</span>
            <input
              type="number"
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              min={5}
              step={5}
              disabled={!autoSync}
              className="w-16 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-center disabled:opacity-50"
            />
            <span>минут (минимум 5)</span>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={updatePrices} onChange={(e) => setUpdatePrices(e.target.checked)} className="w-4 h-4 rounded" />
            Обновлять цены товаров при синке
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hideMissing} onChange={(e) => setHideMissing(e.target.checked)} className="w-4 h-4 rounded" />
            Скрывать товары, исчезнувшие у поставщика (восстанавливать при возврате)
          </label>

          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-4 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      )}
    </div>
  );
}
