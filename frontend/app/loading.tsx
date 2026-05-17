import { Loader2 } from 'lucide-react';

// Глобальный индикатор загрузки на время рендера серверных компонентов.
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
    </div>
  );
}
