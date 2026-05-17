'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BlogEditor } from '@/components/admin/BlogEditor';
import { getAdminBlogPost, type AdminBlogPost } from '@/lib/admin';

export default function EditBlogPostPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [post, setPost] = useState<AdminBlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminBlogPost(id)
      .then(setPost)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, [id]);

  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>;
  if (!post) return <div className="p-6 text-sm text-slate-500">Загрузка…</div>;

  return <BlogEditor initial={post} />;
}
