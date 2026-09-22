"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

interface AuthDialogProps {
  /** id заголовка внутри: по нему диалог называет себя (aria-labelledby). */
  labelledBy: string;
  children: ReactNode;
}

/**
 * Модалка входа поверх текущей страницы (Auth.dc.html) и нижний лист на телефоне (Auth-mobile.dc.html).
 *
 * Нативный <dialog> со showModal(): фокус-ловушку, Esc, inert для страницы под ним и возврат фокуса
 * на «Войти» после закрытия даёт браузер, а не наш код. Клиентский лист нужен ровно для двух вещей:
 * вызвать showModal() и по закрытию вернуться назад по истории — адрес /login открыла навигация,
 * значит и закрывает её навигация, а не прятанье окна.
 *
 * Содержимое приходит детьми с сервера: карточка входа читает ключ Google и в бандл не попадает.
 */
export function AuthDialog({ labelledBy, children }: AuthDialogProps) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={labelledBy}
      // Esc, крестик и нажатие мимо окна сходятся сюда: одно закрытие — один шаг назад по истории.
      onClose={() => router.back()}
      // Нажатие по затемнению приходит в сам <dialog>: у окна нет своих полей, всё содержимое внутри.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={[
        "glass-modal m-auto max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100%-2rem))] max-w-none overflow-y-auto rounded-xl border border-fill-2 p-0 text-text",
        // Телефон: нижний лист во всю ширину, прижат к низу, ручка сверху.
        "max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:rounded-b-none max-sm:border-b-0",
        // Затемнение под окном размывает страницу, которая под ним реально есть (docs/04, «Стекло»).
        "backdrop:bg-bg/70 backdrop:backdrop-blur-[10px]",
        // Единственное авторское движение: 180 мс, затухающее ускорение, из уже видимого состояния.
        "transition-[opacity,translate] duration-[180ms] ease-out starting:translate-y-3 starting:opacity-0",
      ].join(" ")}
    >
      <div aria-hidden="true" className="flex justify-center pt-2.5 sm:hidden">
        <span className="h-1 w-10 rounded-full bg-fill-2" />
      </div>
      {children}
    </dialog>
  );
}

/**
 * Крестик. Отдельной клиентской кнопкой, потому что стоит внутри серверной карточки: закрывает
 * ближайший <dialog>, а дальше всё решает onClose выше — тот же путь, что у Esc.
 */
export function AuthDialogClose() {
  return (
    <button
      type="button"
      onClick={(event) => event.currentTarget.closest("dialog")?.close()}
      className="-mt-1.5 -mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-sm border border-line bg-fill text-text-2 hover:bg-fill-2 hover:text-text"
    >
      <span className="sr-only">Закрыть</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor">
        <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
