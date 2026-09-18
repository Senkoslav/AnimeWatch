import type { ReactNode } from "react";

/**
 * Место в юридическом тексте, где нужны данные владельца сайта. Видно и заказчику, и на проде,
 * пока текст не заполнен: тихая заглушка на странице соглашения хуже честной пометки.
 */
export function ToCheck({ children }: { children: ReactNode }) {
  return (
    <aside className="rounded-md border border-line bg-surface p-4 text-sm text-muted">
      <p className="font-medium text-text">Требует проверки перед запуском</p>
      <p className="mt-1">{children}</p>
    </aside>
  );
}
