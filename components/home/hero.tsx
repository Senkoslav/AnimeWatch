import Image from "next/image";
import Link from "next/link";

import { FreshMark } from "@/components/ui/fresh-mark";
import { Poster } from "@/components/ui/poster";
import { formatEpisodeNumber, formatRelativeDate, isFresh } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
import type { Release } from "@/lib/queries/home";
import { episodeHref } from "@/lib/routes";

interface HeroProps {
  release: Release;
  now: Date;
}

/** Последний выпуск. Кадр из серии, если он есть; иначе постер рядом с текстом. */
export function Hero({ release, now }: HeroProps) {
  const { title, number, thumbUrl } = release;
  const isMovie = title.kind === TitleKind.MOVIE;

  return (
    <section aria-labelledby="hero-title" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        {thumbUrl ? (
          <div className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-md border border-line bg-surface">
              <Image
                src={thumbUrl}
                alt=""
                fill
                preload
                sizes="(min-width: 1152px) 1120px, 100vw"
                className="object-cover"
              />
              {!isMovie && (
                <p
                  aria-hidden="true"
                  className="absolute bottom-3 left-3 rounded-sm bg-bg px-2 font-display text-2xl font-bold md:text-3xl"
                >
                  {formatEpisodeNumber(number)}
                </p>
              )}
            </div>
            <HeroText release={release} now={now} />
          </div>
        ) : (
          // На телефоне — те же две колонки, что у ленты: постер героя не мельче карточки под ним.
          <div className="grid grid-cols-2 items-start gap-x-4 md:flex md:gap-8">
            <Poster
              src={title.posterUrl}
              title={title.nameRu}
              sizes="(min-width: 768px) 192px, 50vw"
              loading="preload"
              className="md:w-48 md:shrink-0"
            />
            <HeroText release={release} now={now} showNumber={!isMovie} />
          </div>
        )}
      </div>
    </section>
  );
}

function HeroText({ release, now, showNumber = false }: HeroProps & { showNumber?: boolean }) {
  const { title, number, name, publishedAt } = release;
  const isMovie = title.kind === TitleKind.MOVIE;

  return (
    <div className="flex min-w-0 flex-col items-start gap-3">
      <h2 id="hero-title" className="text-base font-semibold text-balance md:text-xl md:leading-tight">
        {title.nameRu}
      </h2>
      {showNumber && (
        // Номер дублем: крупная цифра и есть «Эпизод 03», второй раз в строке ниже не повторяем.
        // В DOM после заголовка, чтобы переход по заголовкам не пропускал номер; на экране — над ним.
        <p className="order-first flex flex-col">
          <span className="text-sm text-muted">Эпизод</span>
          <span className="font-display text-2xl font-bold md:text-3xl">{formatEpisodeNumber(number)}</span>
        </p>
      )}
      {(!showNumber || name) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {!showNumber && (
            <span className="text-text">{isMovie ? "Фильм" : `Эпизод ${formatEpisodeNumber(number)}`}</span>
          )}
          {name && <span>{name}</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>
          вышел <time dateTime={publishedAt.toISOString()}>{formatRelativeDate(publishedAt, now)}</time>
        </span>
        {isFresh(publishedAt, now) && <FreshMark />}
      </div>
      <Link
        href={episodeHref(title.slug, number)}
        className="mt-1 inline-flex min-h-11 items-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted"
      >
        Смотреть
      </Link>
    </div>
  );
}
