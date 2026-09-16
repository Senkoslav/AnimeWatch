import Link from "next/link";

import { FreshMark } from "@/components/ui/fresh-mark";
import { formatCount, formatDuration, formatEpisodeNumber, isFresh } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
import type { TitlePage } from "@/lib/queries/title";
import { episodeHref } from "@/lib/routes";

interface EpisodeListProps {
  title: Pick<TitlePage, "slug" | "kind" | "totalEpisodes" | "episodes">;
  now: Date;
}

/** Список серий — основной блок страницы на телефоне. Полоса прогресса появится вместе с его сохранением. */
export function EpisodeList({ title, now }: EpisodeListProps) {
  const { episodes, totalEpisodes, kind, slug } = title;
  const isMovie = kind === TitleKind.MOVIE;
  const count =
    totalEpisodes && totalEpisodes > episodes.length
      ? `${episodes.length} из ${totalEpisodes}`
      : formatCount(episodes.length, ["серия", "серии", "серий"]);

  return (
    <section aria-labelledby="episodes-title">
      <h2 id="episodes-title" className="flex items-baseline gap-3 text-lg font-semibold">
        {isMovie ? "Фильм" : "Серии"}
        {!isMovie && episodes.length > 0 && <span className="text-sm font-normal text-muted">{count}</span>}
      </h2>

      {episodes.length === 0 ? (
        <p className="mt-3 text-muted">Первая серия ещё в работе.</p>
      ) : (
        <ol className="mt-3 border-y border-line">
          {episodes.map((episode) => {
            const number = formatEpisodeNumber(episode.number);
            const label = isMovie ? "Фильм" : (episode.name ?? `Эпизод ${episode.number}`);
            const duration = episode.duration ? formatDuration(episode.duration) : null;
            const fresh = isFresh(episode.publishedAt, now);

            return (
              <li key={episode.id} className="border-b border-line last:border-b-0">
                <Link
                  href={episodeHref(slug, episode.number)}
                  // Строка собрана из нескольких span: без aria-label скринридер склеил бы номер и название.
                  aria-label={[
                    isMovie ? "Фильм" : `Эпизод ${number}`,
                    episode.name,
                    duration && `длительность ${duration}`,
                    fresh ? "новая" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  className="flex min-h-14 items-center gap-4 px-2 hover:bg-surface-2"
                >
                  {!isMovie && <span className="w-10 shrink-0 font-display text-lg font-bold">{number}</span>}
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {fresh && <FreshMark />}
                  {duration && <span className="shrink-0 text-sm text-muted tabular-nums">{duration}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
