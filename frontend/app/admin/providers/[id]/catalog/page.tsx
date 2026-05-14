'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Search, Zap } from 'lucide-react';
import {
  connectAllProviderProductsBatch,
  getProviderCatalog,
  syncProviderCatalog,
  type ProviderCatalogItem,
  type ProviderCatalogQuery,
  type ProviderCatalogResponse,
} from '@/lib/admin';

export default function ProviderCatalogPage() {
  const params = useParams<{ id: string }>();
  const providerId = Number(params.id);

  const [catalog, setCatalog] = useState<ProviderCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NonNullable<ProviderCatalogQuery['filter']>>('unconnected');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncOutput, setSyncOutput] = useState<string | null>(null);

  // Массовое подключение
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: number;
    skipped_items: Array<{ external_id: string; name: string; reason: string }>;
  } | null>(null);

  const PER_PAGE = 50;

  const load = async () => {
    setLoading(true);
    try {
      setCatalog(
        await getProviderCatalog(providerId, {
          filter,
          q: search || undefined,
          page,
          per_page: PER_PAGE,
        }),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  // Сбрасываем страницу на 1 при смене фильтра/поиска
  useEffect(() => {
    setPage(1);
  }, [filter, search, providerId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, providerId, page]);

  const sync = async () => {
    setSyncing(true);
    setSyncOutput(null);
    try {
      const output = await syncProviderCatalog(providerId);
      setSyncOutput(output || '✓ Синхронизация завершена');
      await load();
    } catch (e) {
      setSyncOutput(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSyncing(false);
    }
  };

  // Массово подключаем неподключённые товары пачками по 200 (чтобы не упереться в таймаут).
  // status='active' — товары сразу попадают на витрину (см. ответ пользователя в этой сессии).
  const connectAll = async () => {
    if (!confirm('Подключить ВСЕ неподключённые товары? Они будут созданы со статусом active и сразу появятся на витрине.')) {
      return;
    }
    setBulkRunning(true);
    setBulkResult(null);
    setBulkProgress({ done: 0, total: 0 });

    let fromId: number | null = null;
    let totalInitial = 0;
    let createdSum = 0;
    let skippedSum = 0;
    const skippedItems: Array<{ external_id: string; name: string; reason: string }> = [];

    try {
      // Цикл: первый запрос даёт total оставшихся; идём пока done === false.
      // Защита от бесконечного цикла — максимум 50 итераций (50*200 = 10k товаров).
      for (let i = 0; i < 50; i++) {
        const batch = await connectAllProviderProductsBatch(providerId, {
          status: 'active',
          limit: 200,
          fromId,
        });
        if (i === 0) totalInitial = batch.total;
        createdSum += batch.created;
        skippedSum += batch.skipped;
        skippedItems.push(...batch.skipped_items);
        fromId = batch.last_id;
        setBulkProgress({ done: totalInitial - batch.total + batch.processed, total: totalInitial });
        if (batch.done) break;
      }
      setBulkResult({ created: createdSum, skipped: skippedSum, skipped_items: skippedItems });
      await load();
    } catch (e) {
      setBulkResult({
        created: createdSum,
        skipped: skippedSum,
        skipped_items: [
          ...skippedItems,
          { external_id: '—', name: '—', reason: e instanceof Error ? e.message : 'Ошибка' },
        ],
      });
    } finally {
      setBulkRunning(false);
      setBulkProgress(null);
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/providers"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-bold text-lg">Каталог поставщика</h1>
          {catalog && (
            <span className="text-xs text-slate-500">
              подключено: <b>{catalog.meta.connected_count}</b> · не подключено:{' '}
              <b>{catalog.meta.unconnected_count}</b>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={connectAll}
            disabled={bulkRunning || syncing || !catalog || catalog.meta.unconnected_count === 0}
            className="h-10 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            title="Создать товары для всех неподключённых позиций (status=active)"
          >
            <Zap className={`w-4 h-4 ${bulkRunning ? 'animate-pulse' : ''}`} />
            {bulkRunning && bulkProgress
              ? `Подключаю ${bulkProgress.done} / ${bulkProgress.total}…`
              : 'Подключить все'}
          </button>
          <button
            onClick={sync}
            disabled={syncing || bulkRunning}
            className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация…' : 'Синхронизировать каталог'}
          </button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {syncOutput && (
          <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-xl text-xs whitespace-pre-wrap break-all">
            {syncOutput}
          </pre>
        )}

        {bulkResult && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">Массовое подключение завершено:</span>
              <span className="text-xs px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                создано {bulkResult.created}
              </span>
              {bulkResult.skipped > 0 && (
                <span className="text-xs px-2 py-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  пропущено {bulkResult.skipped}
                </span>
              )}
              <button
                onClick={() => setBulkResult(null)}
                className="ml-auto text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Скрыть
              </button>
            </div>
            {bulkResult.skipped_items.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="text-xs text-slate-500 mb-2">
                  Эти товары не подключились — нет цены или не зеркалирована категория. Можно подключить вручную через форму.
                </div>
                <div className="max-h-72 overflow-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">external_id</th>
                        <th className="px-3 py-2 font-medium">Название</th>
                        <th className="px-3 py-2 font-medium">Причина</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {bulkResult.skipped_items.map((it) => (
                        <tr key={it.external_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-mono">{it.external_id}</td>
                          <td className="px-3 py-2">{it.name}</td>
                          <td className="px-3 py-2 text-amber-700 dark:text-amber-300">{it.reason}</td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={`/admin/providers/${providerId}/catalog/${encodeURIComponent(it.external_id)}/connect`}
                              className="text-indigo-600 hover:underline"
                            >
                              Подключить руками →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              placeholder="Поиск по названию…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            {(['unconnected', 'connected', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-8 rounded-lg ${
                  filter === f ? 'bg-white dark:bg-slate-900 shadow-sm font-medium' : 'text-slate-500'
                }`}
              >
                {f === 'unconnected' ? 'Не подключённые' : f === 'connected' ? 'Подключённые' : 'Все'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading && !catalog ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : !catalog || catalog.data.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Каталог пуст. Нажми «Синхронизировать» наверху, чтобы подтянуть товары из FKwallet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {catalog.data.map((item) => (
                <CatalogRow key={item.external_id} providerId={providerId} item={item} />
              ))}
            </div>
          )}
        </div>

        {catalog && catalog.meta.last_page > 1 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-slate-500">
              Страница <b>{catalog.meta.current_page}</b> из <b>{catalog.meta.last_page}</b>
              {' · '}
              всего <b>{catalog.meta.total}</b>
              {' · '}
              показано <b>{catalog.data.length}</b>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={loading || catalog.meta.current_page <= 1}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                « В начало
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || catalog.meta.current_page <= 1}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                ← Назад
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || catalog.meta.current_page >= catalog.meta.last_page}
                className="h-9 px-3 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-40"
              >
                Вперёд →
              </button>
              <button
                onClick={() => setPage(catalog.meta.last_page)}
                disabled={loading || catalog.meta.current_page >= catalog.meta.last_page}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                В конец »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogRow({ providerId, item }: { providerId: number; item: ProviderCatalogItem }) {
  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      {item.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.logo} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100 dark:bg-slate-800" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
          —
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="font-medium line-clamp-1">{item.name}</div>
        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
          <span className="font-mono">#{item.external_id}</span>
          {item.category_name && <span>· {item.category_name}</span>}
          {item.price_in !== null && (
            <span>
              · {item.price_in.toLocaleString('ru', { maximumFractionDigits: 2 })} {item.currency}
            </span>
          )}
        </div>
      </div>

      {item.in_stock === 0 && (
        <span className="text-xs px-2 py-1 rounded-md bg-red-500/15 text-red-500">нет в каталоге FK</span>
      )}

      {item.product_id ? (
        <Link
          href={`/admin/products/${item.product_id}`}
          className="text-sm text-emerald-600 hover:underline"
        >
          ✓ Подключён → товар #{item.product_id}
        </Link>
      ) : (
        <Link
          href={`/admin/providers/${providerId}/catalog/${encodeURIComponent(item.external_id)}/connect`}
          className="h-9 px-4 rounded-lg fk-grad-btn text-sm font-medium flex items-center"
        >
          Подключить
        </Link>
      )}
    </div>
  );
}
