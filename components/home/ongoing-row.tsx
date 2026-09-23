import Link from "next/link";

import { ROW_SCROLL } from "@/components/home/new-episodes";
import { Poster } from "@/components/ui/poster";
import { ScoreBadge } from "@/components/ui/score-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { presetHref, CATALOG_PRESETS } from "@/lib/catalog/params";
import { formatCount } from "@/lib/format";
import type { OngoingTitle } from "@/lib/queries/home";
import { titleHref } from "@/lib/routes";

/** «Смотреть все» ведёт в тот же пресет, что и чип «Онгоинги» над каталогом: один адрес на одно состояние. */
const ONGOING_PRESET = CATALOG_PRESETS.find((preset) => preset.name === "Онгоинги");

interface OngoingRowProps {
  titles: OngoingTitle[];
  total: number;
}

/**
 * «Сейчас выходит» (Main.dc.html): онгоинги по популярности. На десктопе ряд из семи постеров,
 * на телефоне лента вбок — это и есть «карусель онгоингов» из роадмапа, только без стрелок и
 * автопрокрутки: лента листается пальцем, а стрелки на телефоне никто не нажимает.
 */
export function OngoingRow({ titles, total }: OngoingRowProps) {
  return (
    <section aria-labelledby="ongoing-title" className="mx-auto max-w-page px-4 lg:px-8 pt-9">
      <SectionHeading
        id="ongoing-title"
        tone="signal"
        className="mb-4"
        aside={
          <span className="flex items-center gap-4">
            <span className="hidden sm:inline">{formatCount(total, ["тайтл", "тайтла", "тайтлов"])}</span>
            {ONGOING_PRESET && (
              <Link
                href={presetHref(ONGOING_PRESET)}
                className="inline-flex min-h-11 items-center text-muted underline hover:text-text"
              >
                Смотреть все
              </Link>
            )}
          </span>
        }
      >
        Сейчас выходит
      </SectionHeading>

      <ul className={`${ROW_SCROLL} lg:grid-cols-7 lg:gap-4`}>
        {titles.map((title, index) => (
          <li key={title.slug} className="w-34 shrink-0 snap-start lg:w-auto">
            <Link href={titleHref(title.slug)} className="group block rounded-md">
              <Poster
                src={title.posterUrl}
                title={title.nameRu}
                sizes="(min-width: 1024px) 150px, 136px"
                loading={index < 2 ? "eager" : "lazy"}
              >
                {title.score !== null && <ScoreBadge score={title.score} />}
                {title.published > 0 && (
                  // Счёт серий на стекле с тёмной основой: постер под ним заранее неизвестен.
                  <span className="glass-panel absolute bottom-2 left-2 rounded-sm border border-line bg-bg/65 px-2 py-0.5 text-xs text-text-2">
                    {title.totalEpisodes && title.totalEpisodes > title.published
                      ? `${title.published} из ${title.totalEpisodes}`
                      : formatCount(title.published, ["серия", "серии", "серий"])}
                  </span>
                )}
              </Poster>
              <p className="mt-2.5 line-clamp-2 min-h-[2lh] text-sm leading-snug font-medium group-hover:underline">
                {title.nameRu}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-dim">Числа на постерах — оценка Shikimori. Своих оценок у сайта пока нет.</p>
    </section>
  );
}
