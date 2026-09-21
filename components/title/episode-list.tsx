import Link from "next/link";

import { FreshMark } from "@/components/ui/fresh-mark";
import { SectionHeading } from "@/components/ui/section-heading";
import { episodeWindow } from "@/lib/episodes";
import { formatCount, formatDuration, formatEpisodeNumber, isFresh } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
import type { TitlePage } from "@/lib/queries/title";
import { episodeHref } from "@/lib/routes";

interface EpisodeListProps {
  title: Pick<TitlePage, "slug" | "kind" | "totalEpisodes" | "episodes">;
  now: Date;
  /** На странице просмотра: серия, которая играет сейчас. */
  currentNumber?: number;
}

/**
 * Список серий — основной блок страницы на телефоне.
 *
 * Все три колонки заданы одной сеткой (.row-ruled): при прокрутке номера и хронометражи
 * собираются в сплошные вертикальные линейки, а не пляшут по ширине от строки к строке.
 *
 * Плотная поверхность, не стекло: под списком ничего нет (docs/04, «Стекло»).
 */
export function EpisodeList({ title, now, currentNumber }: EpisodeListProps) {
  const { episodes: all, totalEpisodes, kind, slug } = title;
  const isMovie = kind === TitleKind.MOVIE;
  // У долгих тайтлов серий больше тысячи: список показывается окном (lib/episodes.ts).
  const { episodes, capped, first, last, total } = episodeWindow(all, currentNumber);
  const count =
    totalEpisodes && totalEpisodes > total
      ? `${total} из ${totalEpisodes}`
      : formatCount(total, ["серия", "серии", "серий"]);

  return (
    <section aria-labelledby="episodes-title" className="overflow-hidden rounded-lg border border-line bg-surface">
      {/* Засечка янтарная: список серий — это то, ради чего сюда пришли, и в нём живёт «сейчас». */}
      <div className="border-b border-line px-4 py-3">
        <SectionHeading id="episodes-title" tone="signal" aside={isMovie ? undefined : count}>
          {isMovie ? "Фильм" : "Серии"}
        </SectionHeading>
      </div>

      {capped && (
        <p className="border-b border-line px-4 py-2 text-xs text-dim">
          Показаны {first}–{last} из {total}
        </p>
      )}

      {episodes.length === 0 ? (
        <p className="px-4 py-6 text-muted">Первая серия ещё в работе.</p>
      ) : (
        <ol>
          {episodes.map((episode) => {
            const number = formatEpisodeNumber(episode.number);
            const label = isMovie ? "Фильм" : episode.name;
            const duration = episode.duration ? formatDuration(episode.duration) : null;
            const fresh = isFresh(episode.publishedAt, now);
            const current = episode.number === currentNumber;

            return (
              <li key={episode.id} className="border-b border-line last:border-b-0">
                <Link
                  href={episodeHref(slug, episode.number)}
                  // Строка собрана из нескольких ячеек: без aria-label скринридер склеил бы номер и название.
                  aria-label={[
                    isMovie ? "Фильм" : `Эпизод ${number}`,
                    episode.name,
                    duration && `длительность ${duration}`,
                    fresh ? "новая" : null,
                    current ? "играет сейчас" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  aria-current={current ? "page" : undefined}
                  /*
                   * Играющая строка помечена янтарём, но не залита им целиком: сплошная заливка
                   * потребовала бы тёмного текста и превратила строку в светлый блок посреди
                   * тёмного списка. Заливка в 14 процентов и янтарный номер говорят то же самое.
                   */
                  className={`row-ruled min-h-12 px-4 py-2 ${current ? "bg-signal-soft" : "hover:bg-surface-2"}`}
                >
                  {!isMovie && (
                    <span className={`font-display text-base font-bold tabular-nums ${current ? "text-signal" : ""}`}>
                      {number}
                    </span>
                  )}
                  {/* Ячейка стоит всегда, даже когда у серии нет своего названия: пустое место в
                      списке — это часть сетки, а не отсутствие строки. Без названия его занимает
                      отточие — линия от названия до времени. */}
                  {label ? (
                    <span className={`min-w-0 truncate text-sm ${current ? "text-text" : "text-text-2"}`}>{label}</span>
                  ) : (
                    <span className="leader min-w-0" aria-hidden="true" />
                  )}
                  <span className="flex items-center gap-3">
                    {fresh && !current && <FreshMark />}
                    <span className={`text-sm tabular-nums ${current ? "text-signal" : "text-dim"}`}>
                      {duration ?? <span aria-hidden="true">—:—</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
