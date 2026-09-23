import { X } from "lucide-react";

import { CloseOnNavigate } from "@/components/auth/close-on-navigate";
import { AUTH_DIALOG_ID } from "@/components/auth/ids";
import { LoginCard } from "@/components/auth/login-card";

const TITLE_ID = "auth-dialog-title";

/**
 * Окно входа (Auth.dc.html, Auth-mobile.dc.html) — единственное место входа на сайте: отдельной
 * страницы нет по решению владельца 2026-09-23.
 *
 * Серверный компонент и один на весь сайт: стоит в корневом лэйауте закрытым, а открывают его кнопки
 * `AuthTrigger` нативной командой `show-modal`. Так окно работает и без нашего JS: браузер сам
 * открывает <dialog> модально, ловит фокус, закрывает по Esc и возвращает фокус на кнопку.
 * `closedby="any"` закрывает окно нажатием мимо него.
 *
 * На десктопе — стекло третьего уровня по центру, на телефоне — нижний лист с ручкой.
 */
export function AuthDialog() {
  return (
    <dialog
      id={AUTH_DIALOG_ID}
      aria-labelledby={TITLE_ID}
      closedby="any"
      className={[
        "glass-modal m-auto max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100%-2rem))] max-w-none overflow-y-auto rounded-xl border border-fill-2 p-0 text-text",
        // Телефон: нижний лист во всю ширину, прижат к низу, ручка сверху.
        "max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:rounded-b-none max-sm:border-b-0",
        // Затемнение под окном размывает страницу, которая под ним реально есть (docs/04, «Стекло»).
        "backdrop:bg-bg/70 backdrop:backdrop-blur-[10px]",
        // Единственное авторское движение: 180 мс, затухающее ускорение, из уже видимого состояния.
        "transition-[opacity,translate] duration-[180ms] ease-out starting:open:translate-y-3 starting:open:opacity-0",
      ].join(" ")}
    >
      <CloseOnNavigate dialogId={AUTH_DIALOG_ID} />
      <div aria-hidden="true" className="flex justify-center pt-2.5 sm:hidden">
        <span className="h-1 w-10 rounded-full bg-fill-2" />
      </div>
      <LoginCard
        titleId={TITLE_ID}
        close={
          // Закрытие той же нативной командой: без JS работает так же, как Esc.
          <button
            type="button"
            commandfor={AUTH_DIALOG_ID}
            command="close"
            className="-mt-1.5 -mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-sm border border-line bg-fill text-text-2 hover:bg-fill-2 hover:text-text"
          >
            <span className="sr-only">Закрыть</span>
            <X aria-hidden="true" className="size-4" />
          </button>
        }
      />
    </dialog>
  );
}
