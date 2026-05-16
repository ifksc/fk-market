import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock, MessageCircle, RefreshCw, ShieldCheck, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Гарантии — FK.market',
  description:
    'Гарантии покупателям FK.market: замена нерабочего товара, быстрая выдача, безопасная оплата и поддержка.',
};

const ITEMS: { icon: React.ReactNode; title: string; text: string }[] = [
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: 'Замена нерабочего товара',
    text:
      'Если код, ключ или доступ не сработал — заменим бесплатно. Откройте обращение в поддержку со страницы заказа в течение 14 дней с момента покупки. Мы проверим и выдадим рабочий товар.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Быстрая выдача',
    text:
      'Большинство товаров выдаётся автоматически сразу после оплаты — код приходит на email и в личный кабинет. Для товаров с ручной выдачей статус виден в деталях заказа.',
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Безопасная оплата',
    text:
      'Оплата проходит на стороне платёжного сервиса — мы не видим и не храним данные вашей карты. Сайт работает по защищённому соединению (HTTPS).',
  },
  {
    icon: <MessageCircle className="w-6 h-6" />,
    title: 'Поддержка на связи',
    text:
      'Возникла проблема — напишите в поддержку. Авторизованные пользователи создают обращение в личном кабинете, гости — по номеру заказа и email. Отвечаем в течение рабочего дня.',
  },
  {
    icon: <RefreshCw className="w-6 h-6" />,
    title: 'О возврате',
    text:
      'После выдачи рабочего кода возврат не предусмотрен — это особенность цифровых товаров: код нельзя «вернуть». Но если товар оказался нерабочим — мы его заменим.',
  },
];

export default function GuaranteesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-xs text-gray-500 dark:text-slate-400 mb-2">
        <Link href="/" className="hover:text-brand-600">Главная</Link> / Гарантии
      </nav>
      <h1 className="text-3xl font-bold mb-1">Гарантии</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
        Покупка цифровых товаров — это быстро и безопасно. Вот что мы гарантируем каждому покупателю.
      </p>

      <div className="space-y-4">
        {ITEMS.map((item) => (
          <section
            key={item.title}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex gap-4"
          >
            <div className="w-12 h-12 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300 flex items-center justify-center">
              {item.icon}
            </div>
            <div>
              <h2 className="font-bold mb-1">{item.title}</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">{item.text}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 text-sm text-gray-600 dark:text-slate-300">
        Остались вопросы?{' '}
        <Link href="/support" className="text-brand-600 hover:underline font-medium">
          Напишите в поддержку
        </Link>{' '}
        — поможем. Также загляните в{' '}
        <Link href="/faq" className="text-brand-600 hover:underline font-medium">
          раздел частых вопросов
        </Link>
        .
      </div>
    </div>
  );
}
