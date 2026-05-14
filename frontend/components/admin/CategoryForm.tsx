'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import {
  createAdminCategory,
  listAdminCategories,
  updateAdminCategory,
  uploadAdminCategoryImage,
  type AdminCategoryFull,
  type AdminCategoryInput,
} from '@/lib/admin';

type Props = {
  initial: AdminCategoryFull | null; // null = создание
};

export function CategoryForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const isProvider = initial?.is_from_provider ?? false;

  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [parentId, setParentId] = useState<number | ''>(initial?.parent_id ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 100);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [showInHeader, setShowInHeader] = useState(initial?.show_in_header ?? false);
  const [isNew, setIsNew] = useState(initial?.is_new ?? false);

  const [allCats, setAllCats] = useState<AdminCategoryFull[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Тянем плоский список для селекта родителя (без самой себя)
    listAdminCategories({ per_page: 500 })
      .then((r) => setAllCats(r.data.filter((c) => c.id !== initial?.id)))
      .catch(() => setAllCats([]));
  }, [initial?.id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: AdminCategoryInput = {
        name,
        icon: icon || null,
        image_url: imageUrl || null,
        sort_order: Number(sortOrder),
        is_active: isActive,
        show_in_header: showInHeader,
        is_new: isNew,
      };
      // Для не-провайдеровских категорий разрешены slug/parent/description
      if (!isProvider) {
        if (slug) payload.slug = slug;
        payload.parent_id = parentId === '' ? null : Number(parentId);
        payload.description = description || null;
      }

      if (isEdit) {
        await updateAdminCategory(initial!.id, payload);
      } else {
        await createAdminCategory(payload);
      }
      router.push('/admin/categories');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось сохранить');
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/categories"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-bold text-lg">{isEdit ? 'Редактировать категорию' : 'Новая категория'}</h1>
          {isProvider && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
              FK · ограниченное редактирование
            </span>
          )}
        </div>
        <button
          form="categoryForm"
          type="submit"
          disabled={submitting || !name}
          className="h-10 px-5 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {submitting ? 'Сохранение…' : 'Сохранить'}
        </button>
      </header>

      <form id="categoryForm" onSubmit={onSubmit} className="p-6 grid lg:grid-cols-[1fr_360px] gap-6 max-w-7xl">
        <section className="space-y-4">
          <Card title="Основное">
            <Field label="Название *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              />
            </Field>
            <Field label="Slug (необязательно — сгенерируется из названия)">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={isProvider}
                placeholder="например, gift-cards"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-sm disabled:opacity-50"
              />
              {isProvider && (
                <p className="text-xs text-slate-400 mt-1">
                  Slug FK-категории менять нельзя — он используется для маппинга при синке
                </p>
              )}
            </Field>
            <Field label="Родительская категория">
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={isProvider}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-50"
              >
                <option value="">— нет (корневая)</option>
                {allCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.is_from_provider ? '· FK' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Описание">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isProvider}
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm disabled:opacity-50"
              />
            </Field>
          </Card>

          <Card title="Оформление">
            <Field label="Иконка (Lucide name, например brain-circuit)">
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="brain-circuit, shield, package…"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                Используется если нет картинки. Список:{' '}
                <a href="https://lucide.dev/icons/" target="_blank" rel="noreferrer" className="underline">
                  lucide.dev/icons
                </a>
              </p>
            </Field>
            <Field label="Картинка категории">
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="preview"
                  className="mb-3 w-28 h-28 rounded-xl object-cover border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800"
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                {isEdit ? (
                  <>
                    <label
                      className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        uploading ? 'opacity-50 cursor-wait' : ''
                      }`}
                    >
                      {uploading ? 'Загрузка…' : 'Загрузить файл'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          try {
                            const updated = await uploadAdminCategoryImage(initial!.id, file);
                            setImageUrl(updated.image_url ?? '');
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Не удалось загрузить');
                          } finally {
                            setUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="h-10 px-3 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        Убрать
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400">
                    Чтобы загрузить файл — сначала сохраните категорию.
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">…или вставить URL вручную:</p>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://… или /storage/…"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm mt-1"
              />
            </Field>
          </Card>
        </section>

        <aside className="space-y-3">
          <Card title="Статус">
            <Field label="Видимость">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Активна (видна на сайте)
              </label>
            </Field>
            <Field label="Верхнее меню">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showInHeader}
                  onChange={(e) => setShowInHeader(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Показывать в шапке сайта
              </label>
            </Field>
            <Field label="Бейдж NEW">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isNew}
                  onChange={(e) => setIsNew(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Показывать плашку «NEW» в шапке и на главной
              </label>
            </Field>
            <Field label="Sort order (меньше = выше)">
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
              />
            </Field>
          </Card>

          {isEdit && (
            <Card title="Служебное">
              <Row label="ID" value={initial!.id} />
              <Row label="Товаров (прямо)" value={initial!.products_count} />
              {initial!.provider_external_id && (
                <Row label="FK ID" value={<code className="font-mono">{initial!.provider_external_id}</code>} />
              )}
            </Card>
          )}
        </aside>
      </form>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="font-bold mb-4">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
