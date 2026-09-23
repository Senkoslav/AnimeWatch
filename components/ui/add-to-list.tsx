import { Plus } from "lucide-react";

import { AuthTrigger } from "@/components/auth/auth-trigger";
import { button } from "@/components/ui/controls";

/**
 * «В список» (Title, Watch, Main). Отметок без аккаунта не бывает, а аккаунтов ещё нет, поэтому
 * кнопка открывает окно входа. Молчащая кнопка хуже: приёмка задачи «Отметки и оценки» прямо
 * требует приглашения войти.
 */
export function AddToList({ size = "md", className = "" }: { size?: "md" | "sm"; className?: string }) {
  return (
    <AuthTrigger className={`${button("secondary", size)} ${className}`}>
      <Plus aria-hidden="true" className="size-4" />В список
    </AuthTrigger>
  );
}
