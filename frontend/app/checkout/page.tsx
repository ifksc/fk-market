'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bitcoin, CreditCard, QrCode, Wallet } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { checkPromocode, createOrder, getPaymentMethods, type PaymentMethodPublic } from '@/lib/api';

const LAST_EMAIL_KEY = 'fk-last-email';

// Дефолтные lucide-иконки по code, если в БД у метода icon не задан
const DEFAULT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  card: CreditCard,
  sbp: QrCode,
  wallet: Wallet,
  crypto: Bitcoin,
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, count, hydrated } = useCart();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [methods, setMethods] = useState<PaymentMethodPublic[]>([]);
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Промокод
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  // Email из localStorage (если был сохранён после прошлой оплаты)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // Способы оплаты из API
  useEffect(() => {
    getPaymentMethods()
      .then((ms) => {
        setMethods(ms);
        // Если способ ещё не выбран — берём первый
        if (ms.length > 0) setPaymentMethod((prev) => prev || ms[0].code);
      })
      .catch(() => setMethods([]));
  }, []);

  // Скидка по промокоду, доп. комиссия метода и итог.
  // Комиссия считается с суммы уже за вычетом скидки — как и на бэкенде.
  const selectedMethod = methods.find((m) => m.code === paymentMethod);
  const discount = appliedPromo?.discount ?? 0;
  const discountedSubtotal = Math.max(0, Math.round((total - discount) * 100) / 100);
  const extraFee = selectedMethod && selectedMethod.extra_fee_pct
    ? Math.round((discountedSubtotal * selectedMethod.extra_fee_pct) / 100 * 100) / 100
    : 0;
  const grandTotal = Math.round((discountedSubtotal + extraFee) * 100) / 100;

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true);
    setPromoError(null);
    try {
      const res = await checkPromocode({
        code,
        items: items.map((i) => ({ product_id: i.product_id, qty: i.qty, params: i.params })),
      });
      if (res.valid) {
        setAppliedPromo({ code: code.toUpperCase(), discount: res.discount });
        setPromoError(null);
      } else {
        setAppliedPromo(null);
        setPromoError(res.message ?? 'Промокод недействителен');
      }
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : 'Не удалось проверить промокод');
    } finally {
      setPromoChecking(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  // Если корзина пуста — редирект на каталог
  if (hydrated && items.length === 0 && !submitting) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Корзина пуста</h1>
        <Link
          href="/catalog"
          className="inline-flex h-11 px-5 rounded-xl fk-grad-btn font-medium items-center"
        >
          Открыть каталог
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agree) {
      setError('Нужно принять оферту и согласие на обработку персональных данных');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrder({
        email,
        phone: phone || undefined,
        payment_method: paymentMethod,
        promocode: appliedPromo?.code,
        items: items.map((item) => ({
          product_id: item.product_id,
          qty: item.qty,
          params: item.params,
        })),
      });

      // Сохраняем email для следующих покупок и номер заказа для success-страницы
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email);
      } catch { /* ignore */ }
      localStorage.setItem('fk-last-order', result.public_number);
      window.location.href = result.payment_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать заказ. Попробуйте ещё раз.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Оформление заказа</h1>

      {/* Степпер */}
      <ol className="flex items-center gap-4 text-sm mb-8">
        <li className="flex items-center gap-2 text-gray-400">
          <span className="w-7 h-7 rounded-full bg-accent-500 text-white flex items-center justify-center text-xs">
            ✓
          </span>
          <span>Корзина</span>
        </li>
        <li className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
        <li className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full fk-grad-btn flex items-center justify-center text-xs font-bold">
            2
          </span>
          <span className="font-medium">Оформление</span>
        </li>
        <li className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
        <li className="flex items-center gap-2 text-gray-400">
          <span className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold">
            3
          </span>
          <span>Оплата и выдача</span>
        </li>
      </ol>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_360px] gap-6">
        <section className="space-y-4">
          {/* Контакты */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="font-bold mb-1">Контактные данные</div>
            <p className="text-xs text-gray-500 mb-4">На этот email придут коды и чек.</p>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="email"
                placeholder="Email *"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
              <input
                type="tel"
                placeholder="Телефон (не обязательно)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          {/* Способы оплаты */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="font-bold mb-1">Способ оплаты</div>
            <p className="text-xs text-gray-500 mb-4">
              Все способы доступны на странице Freekassa после нажатия «Оплатить».
            </p>
            {methods.length === 0 ? (
              <div className="text-sm text-gray-500">Загрузка способов оплаты…</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {methods.map((m) => {
                  const Icon = DEFAULT_ICONS[m.code] ?? CreditCard;
                  const active = paymentMethod === m.code;
                  const belowMin = m.min_amount !== null && total < m.min_amount;
                  const aboveMax = m.max_amount !== null && total > m.max_amount;
                  const disabled = belowMin || aboveMax;
                  return (
                    <label
                      key={m.code}
                      className={`rounded-xl p-4 flex items-start gap-3 transition ${
                        disabled
                          ? 'opacity-50 cursor-not-allowed border border-gray-200 dark:border-slate-800'
                          : active
                          ? 'border-2 border-brand-500 bg-brand-50/50 dark:bg-brand-700/10 cursor-pointer'
                          : 'border border-gray-200 dark:border-slate-800 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pay"
                        checked={active}
                        disabled={disabled}
                        onChange={() => setPaymentMethod(m.code)}
                        className="mt-1 accent-brand-500"
                      />
                      <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {m.name}
                          {m.extra_fee_pct > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              +{m.extra_fee_pct}%
                            </span>
                          )}
                        </div>
                        {m.description && <div className="text-xs text-gray-500">{m.description}</div>}
                        {belowMin && <div className="text-xs text-red-500 mt-1">мин. {m.min_amount} ₽</div>}
                        {aboveMax && <div className="text-xs text-red-500 mt-1">макс. {m.max_amount} ₽</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <label className="text-sm text-gray-500 flex items-start gap-2 px-2">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="accent-brand-500 mt-0.5"
            />
            <span>
              Я принимаю{' '}
              <Link href="/legal/oferta" className="text-brand-600 hover:underline">
                оферту
              </Link>{' '}
              и согласие на{' '}
              <Link href="/legal/privacy" className="text-brand-600 hover:underline">
                обработку персональных данных
              </Link>
            </span>
          </label>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </section>

        {/* Сводка заказа */}
        <aside className="lg:sticky lg:top-20 self-start space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="font-bold text-lg mb-4">Ваш заказ ({count})</div>
            <div className="space-y-3 text-sm max-h-60 overflow-auto">
              {items.map((item) => (
                <div key={item.product_id} className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="line-clamp-1">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.qty} шт</div>
                  </div>
                  <div className="font-semibold">
                    {(item.price * item.qty).toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
                  </div>
                </div>
              ))}
            </div>
            {/* Промокод */}
            <div className="border-t border-gray-200 dark:border-slate-800 mt-4 pt-4">
              <div className="text-xs text-gray-500 mb-2">Промокод</div>
              {appliedPromo ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-sm">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{appliedPromo.code}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    −{appliedPromo.discount.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
                  </span>
                  <button
                    type="button"
                    onClick={removePromo}
                    className="ml-auto text-gray-400 hover:text-red-500"
                    aria-label="Убрать промокод"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ВВЕДИТЕ КОД"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyPromo();
                      }
                    }}
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm uppercase"
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={promoChecking || !promoInput.trim()}
                    className="h-10 px-4 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium disabled:opacity-50"
                  >
                    {promoChecking ? '…' : 'Применить'}
                  </button>
                </div>
              )}
              {promoError && <p className="text-xs text-red-500 mt-1.5">{promoError}</p>}
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800 my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Сумма</span>
                <span>{total.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Скидка по промокоду</span>
                  <span>−{discount.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽</span>
                </div>
              )}
              {extraFee > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Комиссия {selectedMethod?.name ?? ''}</span>
                  <span>+{extraFee.toLocaleString('ru', { maximumFractionDigits: 2 })} ₽</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold pt-2">
                <span>К оплате</span>
                <span>{grandTotal.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full h-12 rounded-xl fk-grad-btn font-semibold disabled:opacity-50"
            >
              {submitting ? 'Создаём заказ…' : 'Оплатить'}
            </button>
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => router.push('/cart')}
                className="text-xs text-gray-500 hover:text-brand-600"
              >
                ← Вернуться в корзину
              </button>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
