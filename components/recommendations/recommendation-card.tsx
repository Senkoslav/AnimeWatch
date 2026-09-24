"use client";

import { EyeOff, Undo2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { TitleCard } from "@/components/catalog/title-card";
import { dismissRecommendation, restoreRecommendation } from "@/lib/recommendations/actions";
import type { CatalogItem } from "@/lib/queries/catalog-item";

interface RecommendationCardProps {
  title: CatalogItem;
  /** Почему советуем — готовой строкой (lib/recommendations/reason.ts). */
  reason: string;
  /** «Не интересно» — только у вошедшего: скрытие хранится в аккаунте. */
  canDismiss: boolean;
  eager?: boolean;
  sizes?: string;
}

const MESSAGES = {
  signin: "Войдите, чтобы скрывать советы.",
  invalid: "Не получилось. Обновите страницу.",
  unavailable: "Этот тайтл сейчас недоступен.",
  failed: "Не получилось. Попробуйте ещё раз.",
} as const;

/**
 * Совет: карточка каталога, строка «почему» и «Не интересно». Скрытый совет не исчезает бесследно —
 * на его месте «больше не советуем» и «Вернуть»: нажатие мимо не должно стоить потерянного тайтла.
 * Фокус переходит на кнопку, которая встала на место нажатой, и не падает в начало страницы.
 */
export function RecommendationCard({ title, reason, canDismiss, eager, sizes }: RecommendationCardProps) {
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissButton = useRef<HTMLButtonElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const noteId = useId();

  // Нажатая кнопка исчезла вместе со своим состоянием — фокус на ту, что встала вместо неё.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (hidden ? restoreButton : dismissButton).current?.focus();
  }, [hidden]);

  async function toggle() {
    // Пока сервер не ответил, повторное нажатие ничего не делает. Кнопка не `disabled`: выключенная
    // не принимает фокус, а он переходит на неё сразу после нажатия.
    if (pending) return;
    const next = !hidden;
    moveFocus.current = true;
    setPending(true);
    setError(null);
    setHidden(next);
    try {
      const result = next ? await dismissRecommendation(title.id) : await restoreRecommendation(title.id);
      if (!result.ok) {
        moveFocus.current = true;
        setHidden(!next);
        setError(MESSAGES[result.error]);
      }
    } catch {
      moveFocus.current = true;
      setHidden(!next);
      setError(MESSAGES.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {hidden ? (
        <div className="flex aspect-2/3 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line p-3 text-center">
          <p id={noteId} className="text-sm text-muted">
            «{title.nameRu}» больше не советуем
          </p>
          <button
            ref={restoreButton}
            type="button"
            onClick={toggle}
            aria-disabled={pending || undefined}
            aria-describedby={noteId}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm font-medium text-text-2 hover:bg-fill hover:text-text aria-disabled:cursor-default"
          >
            <Undo2 aria-hidden="true" className="size-4" />
            Вернуть
          </button>
        </div>
      ) : (
        <>
          <TitleCard title={title} eager={eager} sizes={sizes} />
          <p className="text-xs text-muted">{reason}</p>
          {canDismiss && (
            <button
              ref={dismissButton}
              type="button"
              onClick={toggle}
              aria-disabled={pending || undefined}
              // Имя с названием: у каждой карточки своя кнопка. Видимая подпись стоит в начале имени.
              aria-label={`Не интересно: «${title.nameRu}»`}
              className="-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start rounded-sm px-1 text-xs text-dim hover:text-text aria-disabled:cursor-default sm:min-h-8"
            >
              <EyeOff aria-hidden="true" className="size-3.5" />
              Не интересно
            </button>
          )}
        </>
      )}
      {/* Один узел на оба состояния: живая область, созданная вместе с текстом, скринридером не читается. */}
      <p role="status" className="text-xs text-danger empty:hidden">
        {error}
      </p>
    </div>
  );
}
