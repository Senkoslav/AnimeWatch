"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useRef } from "react";

import { AuthTrigger } from "@/components/auth/auth-trigger";
import { useDisplayUser } from "@/components/auth/use-display-user";
import { mutate, useBookmark } from "@/components/bookmarks/store";
import { button } from "@/components/ui/controls";
import { useDismissableDetails } from "@/components/ui/use-dismissable-details";
import { removeMyBookmark, setMyListState } from "@/lib/bookmarks/actions";
import type { WatchState } from "@/lib/generated/prisma/enums";
import { WATCH_STATE_LABELS, WATCH_STATES } from "@/lib/labels";

interface ListControlProps {
  titleId: string;
  size?: "md" | "sm";
  className?: string;
}

/**
 * «В список» (Title, Watch, Main). Аноним видит кнопку входа: отметок без аккаунта не бывает, а
 * молчащая кнопка хуже приглашения. Вошедший — текущий список на кнопке и меню из четырёх списков
 * и «Убрать из списка». Выбранный список — янтарный: это то, что с тайтлом происходит сейчас.
 */
export function ListControl({ titleId, size = "md", className = "" }: ListControlProps) {
  const user = useDisplayUser();
  const { status, bookmark, message } = useBookmark(titleId, user !== null);
  const menu = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(menu);

  if (!user) {
    return (
      <AuthTrigger className={`${button("secondary", size)} ${className}`}>
        <Plus aria-hidden="true" className="size-4" />В список
      </AuthTrigger>
    );
  }

  const loading = status === "loading";
  const current = bookmark?.state ?? null;

  function choose(state: WatchState) {
    if (menu.current) menu.current.open = false;
    void mutate(titleId, { state, rating: bookmark?.rating ?? null }, () => setMyListState(titleId, state));
  }

  function remove() {
    if (menu.current) menu.current.open = false;
    void mutate(titleId, null, () => removeMyBookmark(titleId));
  }

  return (
    <div className={`relative ${className}`}>
      <details ref={menu} className="group">
        <summary
          aria-busy={loading || undefined}
          aria-disabled={loading || undefined}
          /*
           * Пока своя отметка грузится (доли секунды), кнопка на месте, но не открывается: выбор,
           * сделанный до ответа, ответ бы и перезаписал. Что она занята, видно курсором ожидания.
           */
          onClick={(event) => loading && event.preventDefault()}
          className={`${button(current ? "selected" : "secondary", size)} w-full list-none [&::-webkit-details-marker]:hidden ${loading ? "cursor-progress" : "cursor-pointer"}`}
        >
          {current ? <Check aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
          {current ? WATCH_STATE_LABELS[current] : "В список"}
          <ChevronDown aria-hidden="true" className="size-4 opacity-70 transition-transform group-open:rotate-180" />
        </summary>

        <div className="glass-modal absolute right-0 left-0 z-30 mt-2 min-w-56 rounded-md border border-fill-2 p-1.5">
          <p className="px-3 pt-1.5 pb-1 text-xs text-dim">Список</p>
          <ul>
            {WATCH_STATES.map((state) => {
              const selected = state === current;
              return (
                <li key={state}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => choose(state)}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 text-left text-sm ${selected ? "bg-signal-soft font-semibold text-signal" : "text-text-2 hover:bg-fill hover:text-text"}`}
                  >
                    <Check aria-hidden="true" className={`size-4 ${selected ? "" : "invisible"}`} />
                    {WATCH_STATE_LABELS[state]}
                  </button>
                </li>
              );
            })}
          </ul>
          {current && (
            <div className="mt-1.5 border-t border-line pt-1.5">
              <button
                type="button"
                onClick={remove}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 text-left text-sm text-muted hover:bg-fill hover:text-text"
              >
                <X aria-hidden="true" className="size-4" />
                {bookmark?.rating ? "Убрать из списка и снять оценку" : "Убрать из списка"}
              </button>
            </div>
          )}
        </div>
      </details>
      {/* Отказ сервера словами рядом с кнопкой, а не молчаливый откат. */}
      <p role="status" className="empty:hidden mt-2 text-xs text-danger">
        {message}
      </p>
    </div>
  );
}
