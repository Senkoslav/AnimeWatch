/**
 * Нативные команды кнопок и лёгкое закрытие диалога (HTML Invoker Commands, `closedby`).
 * React 19.3 их ещё не знает, но строчные атрибуты пропускает в DOM как есть — не хватает только
 * типов. Ими модалка входа открывается без нашего скрипта (components/auth/auth-trigger.tsx).
 */
import "react";

declare module "react" {
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    command?: "show-modal" | "close" | "request-close";
    commandfor?: string;
  }

  interface DialogHTMLAttributes<T> extends HTMLAttributes<T> {
    closedby?: "any" | "closerequest" | "none";
  }
}
