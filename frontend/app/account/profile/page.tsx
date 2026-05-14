'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import {
  AuthError,
  changeEmailRequest,
  changePassword,
  updateProfile,
} from '@/lib/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, setUser } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/account/profile');
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Загрузка…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Профиль</h1>
        <Link href="/account" className="text-sm text-gray-500 hover:text-brand-600">← В кабинет</Link>
      </div>

      <ProfileForm
        initialName={user.name ?? ''}
        initialPhone={user.phone ?? ''}
        onSave={async (patch) => {
          const updated = await updateProfile(patch);
          setUser(updated);
        }}
      />

      <EmailSection
        currentEmail={user.email}
        verified={user.email_verified}
      />

      <PasswordSection />
    </div>
  );
}

// ---------- Имя/телефон ----------

function ProfileForm({
  initialName,
  initialPhone,
  onSave,
}: {
  initialName: string;
  initialPhone: string;
  onSave: (patch: { name: string | null; phone: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => { setName(initialName); setPhone(initialPhone); }, [initialName, initialPhone]);

  const dirty = name !== initialName || phone !== initialPhone;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await onSave({ name: name.trim() || null, phone: phone.trim() || null });
      setNotice({ kind: 'ok', text: 'Сохранено' });
    } catch (e) {
      const text = e instanceof AuthError ? e.message : 'Ошибка';
      setNotice({ kind: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Личные данные">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Имя">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как к вам обращаться"
            className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          />
        </Field>
        <Field label="Телефон">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7…"
            className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          />
        </Field>
        <FormActions notice={notice}>
          <button
            type="submit"
            disabled={busy || !dirty}
            className="h-10 px-5 rounded-xl fk-grad-btn text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </FormActions>
      </form>
    </Section>
  );
}

// ---------- Email ----------

function EmailSection({ currentEmail, verified }: { currentEmail: string | null; verified: boolean }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const r = await changeEmailRequest({
        new_email: newEmail.trim(),
        // Пароль нужен только для смены существующего email.
        ...(currentEmail ? { password } : {}),
      });
      setPending(r.pending_email);
      setOpen(false);
      setPassword('');
    } catch (e) {
      const text = e instanceof AuthError ? e.message : 'Ошибка';
      setNotice({ kind: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Email">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{currentEmail || <span className="text-gray-400 italic">не указан</span>}</span>
          {!currentEmail ? null : verified ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> подтверждён
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> не подтверждён
            </span>
          )}
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            disabled={Boolean(currentEmail) && !verified}
            title={Boolean(currentEmail) && !verified ? 'Сначала подтвердите текущий email' : undefined}
            className="text-sm text-brand-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
          >
            {currentEmail ? 'Сменить email' : 'Указать email'}
          </button>
        )}
      </div>

      {pending && (
        <div className="mt-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-sm text-emerald-700 dark:text-emerald-300">
          Мы отправили код подтверждения на <b>{pending}</b>. Введите его на странице{' '}
          <Link href="/verify-email" className="underline">подтверждения почты</Link>.
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Field label="Новый email">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </Field>
          {currentEmail && (
            <Field label="Текущий пароль">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </Field>
          )}
          <FormActions notice={notice}>
            <button
              type="submit"
              disabled={busy}
              className="h-10 px-5 rounded-xl fk-grad-btn text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Отправляем…' : 'Отправить код'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setNotice(null); }}
              className="h-10 px-4 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Отмена
            </button>
          </FormActions>
        </form>
      )}
    </Section>
  );
}

// ---------- Пароль ----------

function PasswordSection() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const reset = () => { setCurrent(''); setNewPwd(''); setConfirm(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirm) {
      setNotice({ kind: 'error', text: 'Пароли не совпадают' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await changePassword({
        current_password: current,
        password: newPwd,
        password_confirmation: confirm,
      });
      reset();
      setOpen(false);
      setNotice({ kind: 'ok', text: 'Пароль изменён' });
    } catch (e) {
      const text = e instanceof AuthError ? e.message : 'Ошибка';
      setNotice({ kind: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Пароль">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-500">Используется при входе</span>
        {!open && (
          <button onClick={() => setOpen(true)} className="text-sm text-brand-600 hover:underline">
            Сменить пароль
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Field label="Текущий пароль">
            <input
              type="password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </Field>
          <Field label="Новый пароль">
            <input
              type="password"
              required
              minLength={8}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
              placeholder="от 8 символов"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </Field>
          <Field label="Повторите">
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </Field>
          <FormActions notice={notice}>
            <button
              type="submit"
              disabled={busy}
              className="h-10 px-5 rounded-xl fk-grad-btn text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Сохраняем…' : 'Сменить пароль'}
            </button>
            <button
              type="button"
              onClick={() => { reset(); setOpen(false); setNotice(null); }}
              className="h-10 px-4 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Отмена
            </button>
          </FormActions>
        </form>
      )}

      {!open && notice && (
        <div className={`mt-3 text-sm ${notice.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
          {notice.text}
        </div>
      )}
    </Section>
  );
}

// ---------- Общие ----------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function FormActions({
  notice,
  children,
}: {
  notice: { kind: 'ok' | 'error'; text: string } | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      {children}
      {notice && (
        <span className={`text-sm ${notice.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
          {notice.text}
        </span>
      )}
    </div>
  );
}
