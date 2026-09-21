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
      className="group block rounded-md"
    >
      {/* Метка «новая» уехала на постер: в подписи она переносилась на свою строку, и карточки в
          ряду вставали разной высоты — линейки под ними переставали собираться. */}
      <Poster src={title.posterUrl} title={title.nameRu} sizes={POSTER_SIZES} loading={eager ? "eager" : "lazy"}>
        {fresh && <FreshMark onPoster />}
      </Poster>

      {/* Две строки всегда, как и в карточке каталога: иначе соседние подписи встают на разной высоте. */}
      <p className="mt-2.5 line-clamp-2 min-h-[2.6rem] text-sm leading-snug font-medium group-hover:underline">
        {title.nameRu}
      </p>
      <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-line pt-2 text-xs text-dim">
        <span className="shrink-0 font-medium text-text-2">{episode}</span>
        <time dateTime={publishedAt.toISOString()} className="min-w-0 truncate">
          {released}
        </time>
      </p>
    </Link>
  );
}
