import Link from 'next/link';
import { LogoMark } from './Logo';
// Номер сборки штампуется в build-info.json пайплайном деплоя (GitHub Actions).
// Локально/в репозитории — дефолт "0".
import buildInfo from '../build-info.json';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-slate-800 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <LogoMark size={32} />
            <span className="fk-logo font-bold">FK.market</span>
          </div>
          <p className="text-gray-500 dark:text-slate-400">
            Магазин цифровых товаров: ключи, коды и пополнения с автоматической
            выдачей и гарантией замены.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-3">Магазин</div>
          <ul className="space-y-2 text-gray-500 dark:text-slate-400">
            <li><Link href="/catalog" className="hover:text-brand-600">Каталог</Link></li>
            <li><Link href="/catalog?sort=new" className="hover:text-brand-600">Новинки</Link></li>
            <li><Link href="/blog" className="hover:text-brand-600">Блог</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Помощь</div>
          <ul className="space-y-2 text-gray-500 dark:text-slate-400">
            <li><Link href="/faq" className="hover:text-brand-600">FAQ</Link></li>
            <li><Link href="/guarantees" className="hover:text-brand-600">Гарантии</Link></li>
            <li><Link href="/support" className="hover:text-brand-600">Поддержка</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Документы</div>
          <ul className="space-y-2 text-gray-500 dark:text-slate-400">
            <li><Link href="/legal/oferta" className="hover:text-brand-600">Оферта</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-brand-600">Политика конфиденциальности</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-gray-400 flex items-center justify-between">
          <div>© {new Date().getFullYear()} FK.market · v1.{buildInfo.build}</div>
          <div>ТОО («СИТ») · БИН 220440014920</div>
        </div>
      </div>
    </footer>
  );
}
