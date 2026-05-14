'use client';

import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createAdminPricingRule,
  deleteAdminPricingRule,
  getAdminCategories,
  getAdminPricingRules,
  recomputeAdminPricingBatch,
  updateAdminPricingRule,
  type AdminCategory,
  type AdminPricingRule,
} from '@/lib/admin';

const SCOPE_LABEL: Record<AdminPricingRule['scope'], string> = {
  global: 'Глобальное',
  category: 'Категория',
  seller: 'Продавец',
  product: 'Товар',
};

export default function AdminPricingPage() {
  const [rules, setRules] = useState<AdminPricingRule[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newScopeId, setNewScopeId] = useState<number | ''>('');
  const [newMarkup, setNewMarkup] = useState<string>('20');
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<{ scanned: number; updated: number } | null>(null);
  const [recomputeProgress, setRecomputeProgress] = useState<{ done: number; total: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([getAdminPricingRules(), getAdminCategories()]);
      setRules(r);
      setCategories(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateRule = async (rule: AdminPricingRule, patch: Partial<AdminPricingRule>) => {
    setBusy(true);
    try { await updateAdminPricingRule(rule.id, patch); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setBusy(false); }
  };

  const deleteRule = async (rule: AdminPricingRule) => {
    if (!confirm(`Удалить правило для «${rule.scope_name}»?`)) return;
    setBusy(true);
    try { await deleteAdminPricingRule(rule.id); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setBusy(false); }
  };

  const addCategoryRule = async () => {
    if (!newScopeId) return;
    setBusy(true);
    try {
      await createAdminPricingRule({
        scope: 'category', scope_id: Number(newScopeId),
        markup_pct: Number(newMarkup), priority: 10, is_active: true,
      });
      setNewScopeId(''); setNewMarkup('20');
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setBusy(false); }
  };

  const usedCategoryIds = new Set(rules.filter((r) => r.scope === 'category').map((r) => r.scope_id));
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id));

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <h1 className="font-bold text-lg">Наценки</h1>
        <button
          onClick={async () => {
            if (!confirm('Пересчитать цены всех товаров по текущим правилам?')) return;
            setRecomputing(true);
            setRecomputeResult(null);
            setRecomputeProgress({ done: 0, total: 0 });

            let fromId: number | null = null;
            let totalInitial = 0;
            let scannedSum = 0;
            let updatedSum = 0;

            try {
              // Цикл по батчам — защита от бесконечного цикла 200 итераций × 500 = 100k товаров
              for (let pass = 0; pass < 200; pass++) {
                const batch = await recomputeAdminPricingBatch({ fromId, limit: 500 });
                if (pass === 0) totalInitial = batch.total;
                scannedSum += batch.scanned;
                updatedSum += batch.updated;
                fromId = batch.last_id;
                setRecomputeProgress({ done: scannedSum, total: totalInitial });
                if (batch.done) break;
              }
              setRecomputeResult({ scanned: scannedSum, updated: updatedSum });
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Ошибка');
            } finally {
              setRecomputing(false);
              setRecomputeProgress(null);
            }
          }}
          disabled={recomputing}
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          title="Пересчитать price_final и variants[].price у всех товаров"
        >
          <RefreshCw className={`w-4 h-4 ${recomputing ? 'animate-spin' : ''}`} />
          {recomputing && recomputeProgress
            ? `Пересчёт ${recomputeProgress.done} / ${recomputeProgress.total}…`
            : recomputing
            ? 'Пересчёт…'
            : 'Пересчитать цены'}
        </button>
      </header>

      <div className="p-6 space-y-4 max-w-4xl">
        <div className="bg-brand-50 dark:bg-slate-900 border border-brand-500/30 rounded-2xl p-5 text-sm text-slate-600 dark:text-slate-300">
          Правила применяются по убыванию специфичности: <b>товар → продавец → категория → глобально</b>. Если у товара
          явно указана <code>markup_pct</code> — она побеждает все правила. После изменения правил —
          жми «Пересчитать цены» в шапке, чтобы price_final у всех Product'ов обновилась.
        </div>

        {recomputeResult && (
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between text-sm">
            <span>
              Пересчёт завершён · обработано <b>{recomputeResult.scanned}</b>, изменилось <b>{recomputeResult.updated}</b>
            </span>
            <button onClick={() => setRecomputeResult(null)} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              Скрыть
            </button>
          </div>
        )}

        {loading && rules.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-500">{error}</div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 text-left bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Scope</th>
                    <th className="px-4 py-3 font-medium">Применяется к</th>
                    <th className="px-4 py-3 font-medium">Наценка %</th>
                    <th className="px-4 py-3 font-medium">Приоритет</th>
                    <th className="px-4 py-3 font-medium">Активно</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-md font-medium bg-slate-500/10">{SCOPE_LABEL[r.scope]}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{r.scope_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <input type="number" step="0.01" defaultValue={r.markup_pct}
                          onBlur={(e) => { const v = Number(e.target.value); if (v !== r.markup_pct) updateRule(r, { markup_pct: v }); }}
                          className="w-20 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm" />
                        <span className="ml-1 text-slate-500">%</span>
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" defaultValue={r.priority}
                          onBlur={(e) => { const v = Number(e.target.value); if (v !== r.priority) updateRule(r, { priority: v }); }}
                          className="w-16 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={r.is_active}
                          onChange={(e) => updateRule(r, { is_active: e.target.checked })}
                          className="accent-brand-500" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.scope !== 'global' && (
                          <button onClick={() => deleteRule(r)} disabled={busy} className="text-red-500 hover:text-red-700 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="font-bold mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Добавить правило для категории
          </div>
          {availableCategories.length === 0 ? (
            <div className="text-sm text-slate-500">Все категории уже имеют правила</div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block flex-1 min-w-[200px]">
                <span className="text-xs text-slate-500 mb-1 block">Категория</span>
                <select value={newScopeId} onChange={(e) => setNewScopeId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <option value="">— выбери —</option>
                  {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 mb-1 block">Наценка %</span>
                <input type="number" step="0.01" value={newMarkup} onChange={(e) => setNewMarkup(e.target.value)}
                  className="w-24 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" />
              </label>
              <button onClick={addCategoryRule} disabled={busy || !newScopeId}
                className="h-10 px-4 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-50">
                Добавить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
