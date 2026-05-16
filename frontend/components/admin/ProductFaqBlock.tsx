'use client';

import { useEffect, useState } from 'react';
import {
  createAdminFaq,
  getProductFaq,
  listAdminFaq,
  syncProductFaq,
  type AdminFaqItem,
} from '@/lib/admin';

/**
 * Блок «Частые вопросы товара» на странице товара в админке.
 * Привязка вопросов из пула + inline-создание нового вопроса.
 * Самодостаточен — грузит и сохраняет данные сам.
 */
export function ProductFaqBlock({ productId }: { productId: number }) {
  const [attached, setAttached] = useState<AdminFaqItem[]>([]);
  const [pool, setPool] = useState<AdminFaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [inGeneral, setInGeneral] = useState(false);

  useEffect(() => {
    Promise.all([getProductFaq(productId), listAdminFaq()])
      .then(([att, all]) => {
        setAttached(att);
        setPool(all);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [productId]);

  const sync = async (ids: number[]) => {
    setBusy(true);
    setErr(null);
    try {
      setAttached(await syncProductFaq(productId, ids));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const attach = (id: number) => {
    if (!id || attached.some((x) => x.id === id)) return;
    sync([...attached.map((x) => x.id), id]);
  };

  const detach = (id: number) => sync(attached.filter((x) => x.id !== id).map((x) => x.id));

  const createAndAttach = async () => {
    if (!q.trim() || !a.trim()) {
      setErr('Заполните вопрос и ответ');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const created = await createAdminFaq({
        question: q.trim(),
        answer: a.trim(),
        is_general: inGeneral,
      });
      setPool((p) => [...p, created]);
      setAttached(await syncProductFaq(productId, [...attached.map((x) => x.id), created.id]));
      setQ('');
      setA('');
      setInGeneral(false);
      setShowCreate(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось создать');
    } finally {
      setBusy(false);
    }
  };

  const available = pool.filter((p) => !attached.some((x) => x.id === p.id));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="font-bold mb-4">Частые вопросы товара</div>

      {loading ? (
        <div className="text-sm text-slate-500">Загрузка…</div>
      ) : (
        <>
          {attached.length === 0 ? (
            <div className="text-sm text-slate-500 mb-3">Вопросов к товару пока нет.</div>
          ) : (
            <div className="space-y-2 mb-3">
              {attached.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
                >
                  <span className="flex-1">{f.question}</span>
                  {!f.is_general && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-500">
                      только товар
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => detach(f.id)}
                    disabled={busy}
                    className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                    title="Отвязать"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Привязать существующий */}
          {available.length > 0 && (
            <select
              value=""
              onChange={(e) => attach(Number(e.target.value))}
              disabled={busy}
              className="w-full h-10 px-3 mb-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            >
              <option value="">+ Привязать существующий вопрос…</option>
              {available.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.question}
                </option>
              ))}
            </select>
          )}

          {/* Inline-создание */}
          {showCreate ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 mt-2 space-y-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={300}
                placeholder="Вопрос"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <textarea
                value={a}
                onChange={(e) => setA(e.target.value)}
                maxLength={5000}
                placeholder="Ответ"
                className="w-full h-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm resize-none"
              />
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={inGeneral}
                  onChange={(e) => setInGeneral(e.target.checked)}
                  className="accent-brand-500"
                />
                Показывать также в общем FAQ (/faq)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createAndAttach}
                  disabled={busy}
                  className="h-9 px-4 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-50"
                >
                  Создать и привязать
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-sm text-brand-600 hover:underline mt-1"
            >
              + Создать новый вопрос
            </button>
          )}

          {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
        </>
      )}
    </div>
  );
}
