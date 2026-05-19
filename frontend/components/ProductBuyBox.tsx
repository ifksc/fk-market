'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, ShieldCheck, Star, Zap } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { validateSteamLogin } from '@/lib/api';
import type { ProductDetail, ProductParam } from '@/lib/types';

const FULFILLMENT_LABEL: Record<string, string> = {
  stock: 'Автовыдача из склада',
  api: 'Запрос к поставщику',
  manual: 'Ручная обработка',
};

export function ProductBuyBox({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { add } = useCart();

  // variantParam — селектор «вариант» (например, региона). Один на товар.
  const variantParam: ProductParam | undefined = useMemo(
    () => (product.required_params ?? []).find((p) => p.type === 'variant_select'),
    [product.required_params],
  );

  // amount_input — динамическая сумма (Steam-пополнение и т.п.)
  const amountParam: ProductParam | undefined = useMemo(
    () => (product.required_params ?? []).find((p) => p.type === 'amount_input'),
    [product.required_params],
  );

  // steam_login — отдельный валидатор. Запоминаем результат debounce-проверки.
  const steamParam: ProductParam | undefined = useMemo(
    () => (product.required_params ?? []).find((p) => p.type === 'steam_login'),
    [product.required_params],
  );

  // Дефолтный вариант — самый дешёвый
  const defaultVariantLabel = variantParam?.variants?.[0]?.label ?? '';
  // Дефолтная сумма — минимум
  const defaultAmount = amountParam?.min ?? 0;

  const [qty, setQty] = useState(1);
  const [params, setParams] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (variantParam) init[variantParam.name] = defaultVariantLabel;
    if (amountParam) init[amountParam.name] = String(defaultAmount);
    return init;
  });
  const [added, setAdded] = useState(false);

  // Состояние валидации steam_login
  const [steamCheck, setSteamCheck] = useState<'idle' | 'pending' | 'valid' | 'invalid'>('idle');
  const steamCheckSeq = useRef(0);

  // Реагируем только на изменение самого логина — иначе при вводе суммы
  // запрос валидации запустится повторно.
  const steamLogin = steamParam ? params[steamParam.name] ?? '' : '';
  useEffect(() => {
    if (!steamParam) return;
    const login = steamLogin.trim();
    if (login.length < 2) {
      setSteamCheck('idle');
      return;
    }
    setSteamCheck('pending');
    const seq = ++steamCheckSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await validateSteamLogin(login);
        if (seq !== steamCheckSeq.current) return;
        setSteamCheck(res.isValid ? 'valid' : 'invalid');
      } catch {
        if (seq !== steamCheckSeq.current) return;
        setSteamCheck('invalid');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [steamLogin, steamParam]);

  // Цена с учётом выбранного варианта/суммы
  const selectedVariant = useMemo(() => {
    if (!variantParam) return null;
    const lbl = params[variantParam.name];
    return variantParam.variants?.find((v) => v.label === lbl) ?? null;
  }, [variantParam, params]);

  const enteredAmount = amountParam ? Number(params[amountParam.name] || 0) : 0;
  const amountFeePct = amountParam?.fee_pct ?? 0;
  const amountPrice = amountParam ? Math.round(enteredAmount * (1 + amountFeePct / 100) * 100) / 100 : 0;

  const effectivePrice = selectedVariant
    ? selectedVariant.price
    : amountParam
    ? amountPrice
    : product.price;

  const updateParam = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): boolean => {
    if (!product.required_params) return true;
    for (const p of product.required_params) {
      const value = params[p.name];
      if (p.required && !value) return false;
      if (p.type === 'amount_input') {
        const v = Number(value);
        if (!isFinite(v) || v <= 0) return false;
        if (p.min !== undefined && v < p.min) return false;
        if (p.max !== undefined && v > p.max) return false;
      }
      if (p.type === 'steam_login' && steamCheck !== 'valid') return false;
    }
    return true;
  };

  // archived/draft товар: карточка видна, но купить нельзя. Бэкенд /checkout
  // тоже отклоняет неактивные товары — это второй (клиентский) барьер.
  const unavailable = product.status !== 'active';

  // Кнопки заблокированы, пока валидация Steam в процессе или поле пустое/невалидное.
  // Это закрывает race-condition: пока debounce-проверка не успела пройти, ничего не покупаем.
  const buyDisabled = unavailable || !validate() || (steamParam ? steamCheck === 'pending' : false);
  const isTopup = !!amountParam;

  const buildCartItem = () => ({
    product_id: product.id,
    slug: product.slug,
    // Если выбран вариант — отражаем его в названии в корзине, чтобы покупатель видел "что именно".
    name: selectedVariant ? `${product.name} · ${selectedVariant.label}` : product.name,
    price: effectivePrice,
    qty,
    category: product.category?.slug,
    image: selectedVariant?.image ?? product.image ?? null,
    fulfillment_mode: product.fulfillment_mode,
    params,
  });

  const handleAddToCart = () => {
    if (unavailable) return;
    if (!validate()) {
      alert('Заполните все обязательные параметры товара');
      return;
    }
    add(buildCartItem());
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (unavailable) return;
    if (!validate()) {
      alert('Заполните все обязательные параметры товара');
      return;
    }
    add(buildCartItem());
    router.push('/checkout');
  };

  return (
    <aside className="lg:sticky lg:top-20 self-start space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          {product.category && (
            <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-700/20 text-brand-700 dark:text-brand-500">
              {product.category.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            {product.rating.toFixed(1)} · {product.sales_count.toLocaleString('ru')} продаж
          </span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">{product.name}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Артикул: FK-{product.id.toString().padStart(5, '0')}
        </p>

        <div className="mt-5 flex items-end gap-3">
          <div className="text-4xl font-extrabold">
            {effectivePrice.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
          </div>
          {variantParam && !selectedVariant && (
            <div className="text-xs text-gray-500 mb-1">от {product.price.toLocaleString('ru')} ₽</div>
          )}
          {product.price_old && !variantParam && (
            <>
              <div className="text-sm text-gray-400 line-through mb-1">
                {product.price_old.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
              </div>
              <div className="text-xs text-accent-600 font-semibold mb-1">
                −{product.discount_pct}%
              </div>
            </>
          )}
        </div>

        {/* Под ценой: какой именно номинал/регион выбран — чтобы цена не висела «голой» */}
        {selectedVariant && (
          <div className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
            за <span className="font-semibold text-gray-800 dark:text-slate-200">{selectedVariant.label}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm p-3 rounded-xl bg-accent-500/10 text-accent-600">
          <Zap className="w-4 h-4" />
          {product.stock_available !== null
            ? `В наличии: ${product.stock_available}`
            : 'Без ограничений'}
        </div>

        {/* Параметры товара */}
        {product.required_params && product.required_params.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Параметры
            </div>
            {product.required_params.map((param) => (
              <div key={param.name}>
                <label className="text-xs text-gray-500 mb-1 block">
                  {param.label}
                  {param.required && ' *'}
                </label>
                {param.type === 'variant_select' && param.variants ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {param.variants.map((v) => {
                      const isSelected = params[param.name] === v.label;
                      return (
                        <button
                          key={v.external_id}
                          type="button"
                          onClick={() => updateParam(param.name, v.label)}
                          className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition text-center ${
                            isSelected
                              ? 'border-2 border-brand-500 bg-brand-50 dark:bg-brand-500/15'
                              : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] leading-none">
                              ✓
                            </span>
                          )}
                          {v.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.image}
                              alt={v.label}
                              loading="lazy"
                              className="w-9 h-6 object-cover rounded-sm bg-slate-100 dark:bg-slate-800"
                            />
                          ) : (
                            <div className="w-9 h-6 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-400">
                              —
                            </div>
                          )}
                          <span className="text-xs leading-tight line-clamp-2">{v.label}</span>
                          <span className="text-sm font-semibold">
                            {v.price.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : param.type === 'select' && param.options ? (
                  <select
                    value={params[param.name] ?? ''}
                    onChange={(e) => updateParam(param.name, e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                  >
                    <option value="" disabled>
                      Выберите…
                    </option>
                    {param.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : param.type === 'steam_login' ? (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="например, valve_user"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={params[param.name] ?? ''}
                      onChange={(e) => updateParam(param.name, e.target.value)}
                      className={`w-full h-10 px-3 pr-9 rounded-xl border bg-white dark:bg-slate-900 text-sm font-mono ${
                        steamCheck === 'valid'
                          ? 'border-emerald-500'
                          : steamCheck === 'invalid'
                          ? 'border-red-500'
                          : 'border-gray-200 dark:border-slate-800'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-sm">
                      {steamCheck === 'pending' && <span className="text-gray-400">…</span>}
                      {steamCheck === 'valid' && <span className="text-emerald-500">✓</span>}
                      {steamCheck === 'invalid' && <span className="text-red-500">✗</span>}
                    </span>
                    {steamCheck === 'invalid' && (
                      <p className="text-xs text-red-500 mt-1">Аккаунт не найден. Проверьте логин.</p>
                    )}
                  </div>
                ) : param.type === 'amount_input' ? (
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        min={param.min}
                        max={param.max}
                        step="1"
                        value={params[param.name] ?? ''}
                        onChange={(e) => {
                          // Не даём ввести больше max — обрезаем при изменении
                          const raw = e.target.value;
                          if (raw === '') {
                            updateParam(param.name, '');
                            return;
                          }
                          const n = Number(raw);
                          if (!isFinite(n)) return;
                          const clamped = param.max !== undefined && n > param.max ? param.max : n;
                          updateParam(param.name, String(clamped));
                        }}
                        className="w-full h-10 pl-3 pr-10 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                      />
                      <span className="absolute right-3 top-2 text-sm text-gray-500">₽</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      {param.min !== undefined && param.max !== undefined && (
                        <>от {param.min.toLocaleString('ru')} до {param.max.toLocaleString('ru')} ₽ · </>
                      )}
                      комиссия {amountFeePct}% · к оплате <b className="text-gray-800 dark:text-slate-100">{amountPrice.toLocaleString('ru', { maximumFractionDigits: 2 })} ₽</b>
                    </p>
                  </div>
                ) : (
                  <input
                    type={param.type === 'email' ? 'email' : 'text'}
                    placeholder={param.hint || param.label}
                    value={params[param.name] ?? ''}
                    onChange={(e) => updateParam(param.name, e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                  />
                )}
                {param.hint && param.type !== 'string' && (
                  <p className="text-xs text-gray-400 mt-1">{param.hint}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Кол-во — скрываем для топап-товаров (amount уже регулируется суммой) */}
        {!isTopup && (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-gray-500">Кол-во</label>
            <div className="flex items-center border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                aria-label="Уменьшить количество"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                aria-label="Количество"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-10 h-9 text-center bg-transparent outline-none"
              />
              <button
                type="button"
                aria-label="Увеличить количество"
                onClick={() => setQty(qty + 1)}
                className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {unavailable ? (
          <div className="mt-5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            Товар снят с продажи и недоступен для покупки.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={buyDisabled}
              className="mt-5 w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {steamParam && steamCheck === 'pending' ? 'Проверяем логин…' : 'Купить сейчас'}
            </button>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={buyDisabled}
              className={`mt-2 w-full h-12 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                added
                  ? 'bg-accent-500 text-white border border-accent-500'
                  : 'border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              {added ? '✓ Добавлено в корзину' : 'В корзину'}
            </button>
          </>
        )}

        <div className="mt-5 space-y-2 text-xs text-gray-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-accent-500" strokeWidth={2.5} />
            Оплата: карта, СБП, кошелёк FKwallet
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-accent-500" strokeWidth={2.5} />
            {product.fulfillment_mode === 'stock' ? 'Код выдаётся автоматически' : 'Выдача после оплаты'}
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-accent-500" strokeWidth={2.5} />
            Замена нерабочего товара в течение 14 дней
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-3">
        <ShieldCheck className="w-10 h-10 text-accent-500 shrink-0" />
        <div className="flex-1 text-sm">
          <div className="font-semibold">FK.market · официально</div>
          <div className="text-xs text-gray-500">Платформа · рейтинг 4.9</div>
        </div>
      </div>
    </aside>
  );
}
