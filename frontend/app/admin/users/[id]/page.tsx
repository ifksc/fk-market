'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, MailX, Settings, ShieldCheck, ShoppingBag, User as UserIcon } from 'lucide-react';
import { getAdminUser, updateAdminUser, type AdminUserDetail } from '@/lib/admin';

const ROLE_LABEL: Record<string, string> = {
  customer: 'Покупатель',
  admin: 'Админ',
  seller: 'Продавец',
  moderator: 'Модератор',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает оплаты',
  paid: 'Оплачен',
  completed: 'Выдан',
  cancelled: 'Отменён',
  refunded: 'Возврат',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600',
  paid: 'bg-blue-500/15 text-blue-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  cancelled: 'bg-slate-500/15 text-slate-600',
  refunded: 'bg-purple-500/15 text-purple-600',
};

export default function AdminUserPage() {
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleSelect, setRoleSelect] = useState<string>('customer');
  const [saving, setSaving] = useState(false);
  const [mgmtError, setMgmtError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    getAdminUser(Number(params.id))
      .then((u) => {
        setUser(u);
        setRoleSelect(u.role);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const applyUpdate = async (data: { is_blocked?: boolean; role?: string }) => {
    if (!user) return;
    setSaving(true);
    setMgmtError(null);
    try {
      const updated = await updateAdminUser(user.id, data);
      setUser({ ...user, role: updated.role, is_blocked: updated.is_blocked });
      setRoleSelect(updated.role);
    } catch (e) {
      setMgmtError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>;
  if (error || !user) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-500 mb-3">{error || 'Пользователь не найден'}</p>
        <Link href="/admin/users" className="text-brand-600 hover:underline">← К списку</Link>
      </div>
    );
  }

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-6 sticky top-0 z-30">
        <Link href="/admin/users" className="text-slate-500 hover:text-brand-600 text-sm">← Пользователи</Link>
        <UserIcon className="w-5 h-5 text-slate-500 ml-2" />
        <h1 className="font-bold text-lg">{user.email}</h1>
      </header>

      <div className="p-6 space-y-6 max-w-5xl">
        {/* Профиль */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Field label="Имя" value={user.name || '—'} />
            <Field label="Телефон" value={user.phone || '—'} />
            <Field label="Роль" value={
              <span className="inline-flex items-center gap-1">
                {user.role === 'admin' && <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />}
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            } />
            <Field label="Статус" value={
              user.is_blocked
                ? <span className="text-red-600">Заблокирован</span>
                : <span className="text-emerald-600">Активен</span>
            } />
            <Field label="Email подтверждён" value={
              user.email_verified
                ? <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Да</span>
                : <span className="text-amber-600 inline-flex items-center gap-1"><MailX className="w-3.5 h-3.5" /> Нет</span>
            } />
            <Field label="Регистрация" value={formatDate(user.created_at)} />
            <Field label="Последний вход" value={formatDate(user.last_login_at) || '—'} />
            <Field label="IP последнего входа" value={user.last_login_ip || '—'} />
          </div>
        </section>

        {/* Сводка */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Всего заказов" value={user.orders_count.toLocaleString('ru')} />
          <Stat label="Потрачено (paid+completed)" value={`${user.orders_total_sum.toLocaleString('ru')} ₽`} />
          <Stat label="Баланс" value={`${user.balance.toLocaleString('ru')} ₽`} />
        </section>

        {/* Управление */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold">Управление</h2>
          </div>
          {mgmtError && (
            <div className="mb-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-600">
              {mgmtError}
            </div>
          )}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center gap-4 py-3">
              <div className="text-sm text-slate-500 w-28 shrink-0">Статус</div>
              <div className="flex-1 text-sm">
                {user.is_blocked
                  ? <span className="text-red-600 font-medium">Заблокирован</span>
                  : <span className="text-emerald-600 font-medium">Активен</span>}
              </div>
              <button
                onClick={() => applyUpdate({ is_blocked: !user.is_blocked })}
                disabled={saving}
                className={`h-9 px-4 rounded-lg text-sm font-medium disabled:opacity-50 ${
                  user.is_blocked
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/15 text-red-600 dark:text-red-400'
                }`}
              >
                {user.is_blocked ? 'Разблокировать' : 'Заблокировать'}
              </button>
            </div>
            <div className="flex items-center gap-4 py-3">
              <div className="text-sm text-slate-500 w-28 shrink-0">Роль</div>
              <div className="flex-1">
                <select
                  value={roleSelect}
                  onChange={(e) => setRoleSelect(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="customer">Покупатель</option>
                  <option value="seller">Продавец</option>
                  <option value="moderator">Модератор</option>
                  <option value="admin">Админ</option>
                </select>
              </div>
              <button
                onClick={() => applyUpdate({ role: roleSelect })}
                disabled={saving || roleSelect === user.role}
                className="h-9 px-4 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-50"
              >
                Сохранить роль
              </button>
            </div>
          </div>
        </section>

        {/* Заказы */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold">История заказов</h2>
            <span className="text-sm text-slate-500 ml-2">{user.orders.length}</span>
          </header>

          {user.orders.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Заказов нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 text-left bg-slate-50 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-3 font-medium">Номер</th>
                    <th className="px-4 py-3 font-medium">Дата</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Товары</th>
                    <th className="px-4 py-3 font-medium text-right">Сумма</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {user.orders.map((o) => (
                    <tr key={o.public_number} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs">{o.public_number}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_COLOR[o.status] ?? 'bg-slate-500/15 text-slate-500'}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {o.items.map((it, i) => (
                          <div key={i} className="text-xs">
                            {it.product_name ?? '—'} <span className="text-slate-400">× {it.qty}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {o.total.toLocaleString('ru')} ₽
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/orders/${o.public_number}`} className="text-brand-600 text-xs hover:underline whitespace-nowrap">
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
