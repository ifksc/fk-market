'use client';

// Клиентская часть каталога. Читает фильтры/сортировку/страницу из URL
// (useSearchParams) и догружает отфильтрованный список через API. Благодаря
// этому серверная страница каталога остаётся статической (ISR): дефолтный
// список рендерится на сервере и кэшируется, а фильтрация — на клиенте.
//
// useSearchParams обязан жить под <Suspense> (см. CatalogView) — иначе сборка
// статической страницы падает с ошибкой CSR-bailout.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CatalogResultsView } from '@/components/CatalogResultsView';
import { getProducts, type ProductsQuery } from '@/lib/api';
import type { Paginated, Product } from '@/lib/types';

type Props = {
  /** slug категории; undefined — общий каталог / поиск */
  category?: string;
  /** Базовый путь страницы — /catalog или /catalog/<slug>. */
  basePath: string;
  /** Дефолтный список (популярные, стр. 1, без фильтров), отрендеренный сервером. */
  initial: Paginated<Product>;
};

export function CatalogResults({ category, basePath, initial }: Props) {
  const sp = useSearchParams();
  const params = {
    q: sp.get('q') ?? undefined,
    sort: sp.get('sort') ?? undefined,
    page: sp.get('page') ?? undefined,
    min_price: sp.get('min_price') ?? undefined,
    max_price: sp.get('max_price') ?? undefined,
    min_rating: sp.get('min_rating') ?? undefined,
  };

  // Дефолтный вид совпадает с серверным `initial` — догрузка не нужна.
  const isDefault =
    !params.q &&
    !params.min_price &&
    !params.max_price &&
    !params.min_rating &&
    (!params.sort || params.sort === 'popular') &&
    (!params.page || params.page === '1');

  const [data, setData] = useState<Paginated<Product>>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDefault) {
      setData(initial);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProducts({
      category,
      q: params.q,
      sort: (params.sort as ProductsQuery['sort']) || 'popular',
      page: params.page ? Number(params.page) : 1,
      min_price: params.min_price ? Number(params.min_price) : undefined,
      max_price: params.max_price ? Number(params.max_price) : undefined,
      min_rating: params.min_rating ? Number(params.min_rating) : undefined,
      per_page: 24,
    })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        /* сеть/API упали — оставляем предыдущий список, не роняем страницу */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDefault,
    category,
    params.q,
    params.sort,
    params.page,
    params.min_price,
    params.max_price,
    params.min_rating,
  ]);

  return (
    <CatalogResultsView data={data} basePath={basePath} params={params} loading={loading} />
  );
}
