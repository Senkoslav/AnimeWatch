import Link from "next/link";

import { EpisodeFrame } from "@/components/home/episode-frame";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatEpisodeNumber, formatRelativeDate, isFresh } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
import type { Release } from "@/lib/queries/home";
import { episodeHref } from "@/lib/routes";

/**
 * На телефоне лента листается вбок; на десктопе — ряд из шести. Лента выходит к краям экрана
 * (-mx-4), а отступ у первой карточки держит scroll-padding: без него прилипание прокрутки
 * выравнивает карточку по краю контейнера и съедает px-4.
 */
export const ROW_SCROLL =
  "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:snap-none lg:scroll-px-0 lg:overflow-visible lg:px-0 lg:pb-0";

interface NewEpisodesProps {
  releases: Release[];
  /** Все серии ленты вышли за последнюю неделю — тогда подпись это и говорит. */
  withinWeek: boolean;
  now: Date;
}

/** «Новые серии» (Main.dc.html): последняя серия каждого тайтла, свежие сверху. */
export function NewEpisodes({ releases, withinWeek, now }: NewEpisodesProps) {
  return (
    <section aria-labelledby="new-episodes-title" className="mx-auto max-w-page px-4 lg:px-8 pt-9">
      {/* Засечка янтарная: новые серии — ровно то, что происходит сейчас. */}
      <SectionHeading
        id="new-episodes-title"
        tone="signal"
        className="mb-4"
        aside={
          <span className="flex items-center gap-4">
            {withinWeek && <span className="hidden sm:inline">за последние семь дней</span>}
            <Link href="/catalog" className="inline-flex min-h-11 items-center text-muted underline hover:text-text">
              Весь каталог
            </Link>
          </span>
        }
      >
        Новые серии
      </SectionHeading>

      <ul className={`${ROW_SCROLL} lg:grid-cols-6 lg:gap-4`}>
        {releases.map((release, index) => {
          const { title, number, publishedAt, thumbUrl } = release;
          const isMovie = title.kind === TitleKind.MOVIE;
          const episode = isMovie ? "Фильм" : `Эпизод ${formatEpisodeNumber(number)}`;
          const released = formatRelativeDate(publishedAt, now);
          const fresh = isFresh(publishedAt, now);

          return (
            <li key={release.episodeId} className="w-46 shrink-0 snap-start lg:w-auto">
              {/* Без aria-label скринридер склеивает строки карточки: «Эпизод 025 часов назад». */}
              <Link
                href={episodeHref(title.slug, number)}
                aria-label={[title.nameRu, episode, `вышел ${released}`, fresh ? "новая" : null]
                  .filter(Boolean)
                  .join(", ")}
                className="group block rounded-md"
              >
                <EpisodeFrame
                  thumbUrl={thumbUrl}
                  posterUrl={title.posterUrl}
                  sizes="(min-width: 1024px) 176px, 184px"
                  posterSizes="(min-width: 1024px) 66px, 69px"
                  // Первые две карточки видны без прокрутки на телефоне.
                  eager={index < 2}
                  className="rounded-md"
                >
                  <span className="glass-panel absolute right-2 bottom-2 rounded-sm border border-line bg-bg/65 px-2 py-0.5 font-display text-base leading-snug font-bold tracking-tight">
                    {isMovie ? "Фильм" : formatEpisodeNumber(number)}
                  </span>
                </EpisodeFrame>
                <p className="mt-2.5 line-clamp-2 min-h-[2lh] text-sm leading-snug font-medium group-hover:underline">
                  {title.nameRu}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-dim">
                  {/* Точка янтарная только у вышедшего за сутки: остальное уже не «сейчас». */}
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${fresh ? "bg-signal" : "bg-line"}`}
                  />
                  <time dateTime={publishedAt.toISOString()}>{released}</time>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
