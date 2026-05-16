'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PromocodeForm } from '@/components/admin/PromocodeForm';
import { getAdminPromocode, type AdminPromocode } from '@/lib/admin';

export default function EditPromocodePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [promo, setPromo] = useState<AdminPromocode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminPromocode(id)
      .then(setPromo)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, [id]);

  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>;
  if (!promo) return <div className="p-6 text-sm text-slate-500">Загрузка…</div>;

  return <PromocodeForm initial={promo} />;
}
