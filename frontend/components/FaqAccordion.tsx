/**
 * Аккордеон вопрос-ответ на нативном <details> — без client-JS.
 * Используется и на /faq, и в карточке товара.
 */
export function FaqAccordion({
  items,
}: {
  items: Array<{ id: number; question: string; answer: string }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((f) => (
        <details
          key={f.id}
          className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
        >
          <summary className="cursor-pointer list-none px-4 py-3 font-medium text-sm flex items-center justify-between gap-3">
            <span>{f.question}</span>
            <span className="text-gray-400 text-xl leading-none transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="px-4 pb-4 text-sm text-gray-600 dark:text-slate-300 whitespace-pre-line">
            {f.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
