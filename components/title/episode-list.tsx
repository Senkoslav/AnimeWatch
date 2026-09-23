import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

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
  /** Кадр в строке (страница тайтла, Title.dc.html). */
  thumbs?: boolean;
  /** Подвал: пояснение и действие справа («Начать с первой»). */
  footer?: ReactNode;
}

/**
 * Список серий на странице тайтла — основной её блок на телефоне. Рядом с плеером серии стоят
 * плитками (components/watch/episode-grid.tsx).
 *
 * Все три колонки заданы одной сеткой (.row-ruled): при прокрутке номера и хронометражи
 * собираются в сплошные вертикальные линейки, а не пляшут по ширине от строки к строке.
 *
 * Плотная поверхность, не стекло: под списком ничего нет (docs/04, «Стекло»).
 */
export function EpisodeList({ title, now, thumbs = false, footer }: EpisodeListProps) {
  const { episodes: all, totalEpisodes, kind, slug } = title;
  const isMovie = kind === TitleKind.MOVIE;
  // У долгих тайтлов серий больше тысячи: список показывается окном (lib/episodes.ts).
  const { episodes, capped, first, last, total } = episodeWindow(all);
  const count =
    totalEpisodes && totalEpisodes > total
      ? `вышло ${total} из ${totalEpisodes}`
      : formatCount(total, ["серия", "серии", "серий"]);

  /*
   * Серию без источника помечаем, только когда у тайтла есть и подключённые: если не подключено
   * ничего, об этом уже говорит сама страница, а приглушённый целиком список ничего не различает.
   */
  const connected = all.some((episode) => episode.hasSource);
  const markMissing = connected && all.some((episode) => !episode.hasSource);
  // То же правило для кадров: у импорта с Shikimori их нет вовсе, и пунктирная рамка в каждой строке
  // читалась бы как битые картинки. Колонка появляется, когда кадр есть хотя бы у одной серии.
  const showThumbs = thumbs && all.some((episode) => episode.thumbUrl);

  return (
    <section aria-labelledby="episodes-title" className="overflow-hidden rounded-lg border border-line bg-surface">
      {/* Засечка янтарная: список серий — это то, ради чего сюда пришли, и в нём живёт «сейчас». */}
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <SectionHeading id="episodes-title" tone="signal" aside={isMovie ? undefined : count}>
          {isMovie ? "Фильм" : "Серии"}
        </SectionHeading>
      </div>

      {capped && (
        <p className="border-b border-line px-4 py-2 text-xs text-dim sm:px-5">
          Показаны {first}–{last} из {total}
        </p>
      )}

      {episodes.length === 0 ? (
        <p className="px-4 py-6 text-muted sm:px-5">Первая серия ещё в работе.</p>
      ) : (
        <ol>
          {episodes.map((episode) => {
            const number = formatEpisodeNumber(episode.number);
            const label = isMovie ? "Фильм" : episode.name;
            const duration = episode.duration ? formatDuration(episode.duration) : null;
            const fresh = isFresh(episode.publishedAt, now);
            const missing = markMissing && !episode.hasSource;

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
                    missing ? "источник не подключён" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  className="row-ruled relative min-h-14 px-4 py-2 hover:bg-surface-2 sm:px-5"
                >
                  {!isMovie && (
                    <span
                      className={`font-display text-base font-bold tabular-nums ${missing ? "text-dim" : ""}`}
                    >
                      {number}
                    </span>
                  )}
                  <span className="flex min-w-0 items-center gap-4">
                    {showThumbs && <Thumb src={episode.thumbUrl} />}
                    {/* Ячейка стоит всегда, даже когда у серии нет своего названия: пустое место в
                        списке — это часть сетки, а не отсутствие строки. Без названия его занимает
                        отточие — линия от названия до времени. */}
                    {label ? (
                      <span
                        className={`min-w-0 truncate text-base ${missing ? "text-muted" : "text-text-2"}`}
                      >
                        {label}
                      </span>
                    ) : (
                      <span className="leader min-w-0 flex-1" aria-hidden="true" />
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    {fresh && <FreshMark />}
                    {/* Отсутствие источника показано словом, а не выцветанием строки: прозрачный
                        текст не проходит по контрасту (docs/04, «Компоненты»). */}
                    {missing && <span className="text-xs text-dim">не подключена</span>}
                    <span className="text-sm text-dim tabular-nums">
                      {duration ?? <span aria-hidden="true">—:—</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {footer && <div className="border-t border-line px-4 py-3 sm:px-5">{footer}</div>}
    </section>
  );
}

/** Кадр серии 74×42. Без кадра — пунктирная рамка того же размера: пустое место рисуется, а не пропадает. */
function Thumb({ src }: { src: string | null }) {
  return (
    <span
      aria-hidden="true"
      className={`relative hidden h-[42px] w-[74px] shrink-0 overflow-hidden rounded-sm border sm:block ${src ? "border-line bg-surface-2" : "border-dashed border-line"}`}
    >
      {src && <Image src={src} alt="" fill sizes="74px" className="object-cover" />}
    </span>
  );
}
