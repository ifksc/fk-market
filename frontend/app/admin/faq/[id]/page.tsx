'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaqForm } from '@/components/admin/FaqForm';
import { getAdminFaq, type AdminFaqItem } from '@/lib/admin';

export default function EditFaqPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [item, setItem] = useState<AdminFaqItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminFaq(id)
      .then(setItem)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, [id]);

  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>;
  if (!item) return <div className="p-6 text-sm text-slate-500">Загрузка…</div>;

  return <FaqForm initial={item} />;
}
