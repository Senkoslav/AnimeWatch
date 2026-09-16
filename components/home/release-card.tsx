import Link from "next/link";

import { FreshMark } from "@/components/ui/fresh-mark";
import { Poster } from "@/components/ui/poster";
import { formatEpisodeNumber, formatRelativeDate, isFresh } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
import type { Release } from "@/lib/queries/home";
import { episodeHref } from "@/lib/routes";

const POSTER_SIZES = "(min-width: 1280px) 180px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

interface ReleaseCardProps {
  release: Release;
  now: Date;
  /** Первый ряд на телефоне виден без прокрутки, и его постер крупнее постера героя: грузить сразу. */
  eager?: boolean;
}

/** Карточка ленты «Свежее»: ведёт сразу к просмотру серии. */
export function ReleaseCard({ release, now, eager = false }: ReleaseCardProps) {
  const { title, number, publishedAt } = release;
  const episode = title.kind === TitleKind.MOVIE ? "Фильм" : `Эпизод ${formatEpisodeNumber(number)}`;
  const released = formatRelativeDate(publishedAt, now);
  const fresh = isFresh(publishedAt, now);

  return (
    // Без aria-label скринридер склеивает строки карточки: «Эпизод 025 часов назад».
    <Link
      href={episodeHref(title.slug, number)}
      aria-label={[title.nameRu, episode, `вышел ${released}`, fresh ? "новая" : null].filter(Boolean).join(", ")}
      className="block rounded-md"
    >
      <Poster src={title.posterUrl} title={title.nameRu} sizes={POSTER_SIZES} loading={eager ? "eager" : "lazy"} />
      <p className="mt-2 line-clamp-2 text-sm font-medium">{title.nameRu}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="text-text">{episode}</span>
        <time dateTime={publishedAt.toISOString()}>{released}</time>
        {fresh && <FreshMark />}
      </p>
    </Link>
  );
}
