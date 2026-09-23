import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/ui/section-heading";
import { formatScore } from "@/lib/format";
import { KIND_LABELS } from "@/lib/labels";
import type { PopularTitle } from "@/lib/queries/home";
import { titleHref } from "@/lib/routes";

/**
 * «Популярное за всё время» (Main.dc.html): линованный список по месту у Shikimori. Засечка
 * нейтральная — популярность за всё время не про «сейчас».
 *
 * Номер — это место у Shikimori, а не порядковый номер в списке: у тайтла из пакетного импорта
 * он может быть 12-м, если одиннадцать выше нас не интересуют.
 */
export function PopularList({ titles }: { titles: PopularTitle[] }) {
  return (
    <section aria-labelledby="popular-title" className="min-w-0">
      <SectionHeading id="popular-title" className="mb-4">
        Популярное за всё время
      </SectionHeading>

      <ol className="overflow-hidden rounded-lg border border-line bg-surface">
        {titles.map((title) => (
          <li key={title.slug} className="border-b border-line last:border-b-0">
            <Link
              href={titleHref(title.slug)}
              aria-label={[
                `${title.popularityRank} место`,
                title.nameRu,
                title.score !== null && `оценка ${formatScore(title.score)}`,
              ]
                .filter(Boolean)
                .join(", ")}
              className="flex min-h-17 items-center gap-4 px-4 py-2 hover:bg-surface-2"
            >
              <span className="w-9 shrink-0 font-display text-lg font-bold text-dim tabular-nums">
                {title.popularityRank}
              </span>
              <span className="relative h-13 w-9 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-2">
                {title.posterUrl && <Image src={title.posterUrl} alt="" fill sizes="36px" className="object-cover" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-medium">{title.nameRu}</span>
                <span className="text-xs text-dim">
                  {[title.year, KIND_LABELS[title.kind]].filter(Boolean).join(", ")}
                </span>
              </span>
              {/* Оценка янтарная по закону мира; её отсутствие — прочерком, а не пустотой. */}
              {title.score !== null ? (
                <span className="shrink-0 text-base font-semibold text-signal tabular-nums">
                  {formatScore(title.score)}
                </span>
              ) : (
                <span aria-hidden="true" className="cell-ghost shrink-0">
                  —
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
