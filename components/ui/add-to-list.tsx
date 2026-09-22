import Link from "next/link";

import { button } from "@/components/ui/controls";

/**
 * «В список» (Title, Watch, Main). Отметок без аккаунта не бывает, а аккаунтов ещё нет, поэтому
 * кнопка ведёт во вход — клиентский переход открывает модалку поверх страницы. Молчащая кнопка
 * хуже: приёмка задачи «Отметки и оценки» прямо требует приглашения войти.
 */
export function AddToList({ size = "md", className = "" }: { size?: "md" | "sm"; className?: string }) {
  return (
    <Link href="/login" className={`${button("secondary", size)} ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
      </svg>
      В список
    </Link>
  );
}
