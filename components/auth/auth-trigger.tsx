"use client";

import type { ReactNode } from "react";

import { AUTH_DIALOG_ID } from "@/components/auth/ids";

interface AuthTriggerProps {
  className?: string;
  children: ReactNode;
}

/**
 * Кнопка, открывающая окно входа: «Войти» в шапке и в нижней панели, «В список».
 *
 * Открывает нативной командой `show-modal` — браузер делает это сам, без нашего JS. Клиентский
 * обработчик — запасной путь для браузеров, где команд ещё нет. Где они есть, обработчик click
 * срабатывает раньше команды (она — действие активации кнопки) и открывает окно сам, а команда
 * видит уже открытое модальное окно и ничего не делает. Двойного открытия и ошибки нет.
 */
export function AuthTrigger({ className = "", children }: AuthTriggerProps) {
  return (
    <button
      type="button"
      commandfor={AUTH_DIALOG_ID}
      command="show-modal"
      onClick={() => {
        const dialog = document.getElementById(AUTH_DIALOG_ID);
        if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
      }}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}
