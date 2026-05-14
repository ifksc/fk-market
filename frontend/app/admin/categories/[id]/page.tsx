'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { getAdminCategory, type AdminCategoryFull } from '@/lib/admin';

export default function EditCategoryPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [cat, setCat] = useState<AdminCategoryFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminCategory(id)
      .then(setCat)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, [id]);

  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>;
  if (!cat) return <div className="p-6 text-sm text-slate-500">Загрузка…</div>;

  return <CategoryForm initial={cat} />;
}
