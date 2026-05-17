import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqAccordion } from '@/components/FaqAccordion';
import { JsonLd } from '@/components/JsonLd';
import { getFaq } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Частые вопросы',
  description: 'Ответы на частые вопросы: оплата, выдача товара, возврат и гарантии, аккаунт.',
  alternates: { canonical: '/faq' },
};

export default async function FaqPage() {
  let groups: Awaited<ReturnType<typeof getFaq>> = [];
  try {
    groups = await getFaq();
  } catch {
    groups = [];
  }

  const allItems = groups.flatMap((g) => g.items);

  // FAQPage JSON-LD — Яндекс/Google могут показать вопросы прямо в выдаче.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allItems.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-xs text-gray-500 dark:text-slate-400 mb-2">
        <Link href="/" className="hover:text-brand-600">Главная</Link> / FAQ
      </nav>
      <h1 className="text-3xl font-bold mb-1">Частые вопросы</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
        Оплата, выдача, гарантии и другие вопросы.
      </p>

      {groups.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Раздел пока пуст.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="font-bold text-lg mb-3">{g.category}</h2>
              <FaqAccordion items={g.items} />
            </section>
          ))}
        </div>
      )}

      <div className="mt-10 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 text-sm text-gray-600 dark:text-slate-300">
        Не нашли ответ?{' '}
        <Link href="/support" className="text-brand-600 hover:underline font-medium">
          Напишите в поддержку
        </Link>{' '}
        — поможем.
      </div>

      {allItems.length > 0 && <JsonLd data={jsonLd} />}
    </div>
  );
}
