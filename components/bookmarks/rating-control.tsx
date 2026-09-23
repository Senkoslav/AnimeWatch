"use client";

import { useState } from "react";

import { AuthTrigger } from "@/components/auth/auth-trigger";
import { useDisplayUser } from "@/components/auth/use-display-user";
import { mutate, useBookmark } from "@/components/bookmarks/store";
import { button } from "@/components/ui/controls";
import { setMyRating } from "@/lib/bookmarks/actions";
import { WatchState } from "@/lib/generated/prisma/enums";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * Своя оценка 1–10 рядом с оценкой Shikimori. Десять кнопок-переключателей: на телефоне две строки
 * по пять (меньше 44px тач-цель быть не может, а в строку 360 десять таких не встают), на широком
 * экране одна. Выбранная оценка янтарная — это отметка, которая действует сейчас.
 *
 * Аноним вместо шкалы видит «Оценить», и она открывает окно входа.
 */
export function RatingControl({ titleId }: { titleId: string }) {
  const user = useDisplayUser();
  const { status, bookmark } = useBookmark(titleId, user !== null);
  // Оценка положила тайтл в «Просмотрено» — об этом говорится словами: список сменился не сам.
  const [note, setNote] = useState<string | null>(null);

  if (!user) {
    return (
      <section aria-labelledby="my-rating" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <h2 id="my-rating" className="text-sm font-medium">
            Ваша оценка
          </h2>
          <p className="mt-0.5 text-xs text-dim">От 1 до 10 — после входа.</p>
        </div>
        <AuthTrigger className={button("secondary", "sm")}>Оценить</AuthTrigger>
      </section>
    );
  }

  const rating = bookmark?.rating ?? null;
  const loading = status === "loading";

  async function rate(score: number | null) {
    setNote(null);
    const addsToList = score !== null && !bookmark;
    const result = await mutate(
      titleId,
      score === null ? (bookmark ? { ...bookmark, rating: null } : null) : { state: bookmark?.state ?? WatchState.COMPLETED, rating: score },
      () => setMyRating(titleId, score),
    );
    if (addsToList && result?.ok) setNote("Добавлено в «Просмотрено».");
  }

  return (
    <section aria-labelledby="my-rating" aria-busy={loading || undefined} className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="my-rating" className="text-sm font-medium">
          Ваша оценка
        </h2>
        {rating !== null && (
          <button
            type="button"
            onClick={() => void rate(null)}
            className="inline-flex min-h-11 cursor-pointer items-center text-xs text-muted underline hover:text-text sm:min-h-0"
          >
            Снять оценку
          </button>
        )}
      </div>
      <div role="group" aria-labelledby="my-rating" className="mt-2.5 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {SCORES.map((score) => {
          const selected = score === rating;
          return (
            <button
              key={score}
              type="button"
              disabled={loading}
              aria-pressed={selected}
              aria-label={`Оценка ${score}`}
              onClick={() => void rate(selected ? null : score)}
              className={`inline-flex h-11 cursor-pointer items-center justify-center rounded-sm border font-display text-base font-semibold tabular-nums disabled:cursor-default sm:h-10 ${selected ? "border-signal-line bg-signal-soft text-signal" : "border-line bg-fill text-text-2 hover:bg-fill-2 hover:text-text"}`}
            >
              {score}
            </button>
          );
        })}
      </div>
      <p role="status" className="empty:hidden mt-2.5 text-xs text-signal-muted">
        {note}
      </p>
    </section>
  );
}
