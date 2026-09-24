"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useDisplayUser } from "@/components/auth/use-display-user";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { button } from "@/components/ui/controls";
import { SectionHeading } from "@/components/ui/section-heading";
import { getMyRecommendations, type RecommendationsResult } from "@/lib/recommendations/actions";
import { reasonText } from "@/lib/recommendations/reason";

const ROW = 6;
const SIZES = "(min-width: 1024px) 200px, (min-width: 640px) 33vw, 50vw";

/**
 * «Рекомендуем вам» на главной. Главная — ISR и о пользователе не знает, поэтому ряд подгружается
 * server action в браузере и только у вошедшего: анониму на главной и так есть «Популярное».
 * Стоит ниже первого экрана — его появление не сдвигает то, что уже видно.
 */
export function RecommendedRow() {
  const user = useDisplayUser();
  const [state, setState] = useState<RecommendationsResult | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyRecommendations(ROW)
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch(() => {
        if (!cancelled) setState({ ok: false, error: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Сбой расчёта или лимит — ряд молча уходит: он дополнение к главной, а не её содержание.
  if (!user || (state && !state.ok)) return null;

  return (
    <section
      aria-labelledby="recommended-title"
      aria-busy={!state || undefined}
      className="mx-auto max-w-page px-4 pt-9 lg:px-8"
    >
      <SectionHeading
        id="recommended-title"
        className="mb-4"
        aside={
          <Link
            href="/recommendations"
            className="inline-flex min-h-11 items-center text-muted underline hover:text-text"
          >
            Все рекомендации
          </Link>
        }
      >
        Рекомендуем вам
      </SectionHeading>

      {!state ? (
        // Загрузка нарисована: места под ряд столько же, сколько займут постеры.
        <ul aria-hidden="true" className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: ROW }, (_, index) => (
            <li key={index} className="aspect-2/3 rounded-md border border-line bg-surface" />
          ))}
        </ul>
      ) : state.ok && !state.personal ? (
        // Холодный старт на главной не повторяет «Популярное» ниже — он зовёт отметить пару тайтлов.
        <div className="rounded-lg border border-dashed border-line px-5 py-6">
          <p className="text-base font-medium">Отметьте три тайтла — и здесь появятся советы именно для вас</p>
          <p className="mt-1.5 max-w-[60ch] text-sm text-muted">
            Советы считаются по вашим спискам и оценкам: что смотрите, что досмотрели, что бросили.
          </p>
          <Link href="/catalog" className={`${button("secondary", "sm")} mt-4`}>
            В каталог
          </Link>
        </div>
      ) : state.ok ? (
        <ul aria-label="Советы для вас" className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {state.items.map(({ title, reason }) => (
            <li key={title.id}>
              <RecommendationCard title={title} reason={reasonText(reason)} canDismiss sizes={SIZES} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
