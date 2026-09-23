import Link from "next/link";

import { TEXT_LINK } from "@/components/ui/controls";
import { SectionHeading } from "@/components/ui/section-heading";
import { episodeWindow, WATCH_EPISODE_WINDOW } from "@/lib/episodes";
import { formatEpisodeNumber, isFresh } from "@/lib/format";
import type { TitlePage } from "@/lib/queries/title";
import { episodeHref, titleHref } from "@/lib/routes";

/**
 * Ширина плитки по числу цифр самого длинного номера в окне. Ширина одна на всю сетку: плитки
 * «9» и «10» разной ширины сбивали бы колонки, и ряд прыгал бы на каждом переходе через десяток.
 * Двузначная плитка — квадрат 44×44, меньше тач-цель быть не может.
 */
// Номер в Unbounded 14px — около 11px на цифру, поля по сторонам ~10px, как у двузначной.
const TILE_WIDTH: Record<number, string> = { 2: "w-11", 3: "w-14", 4: "w-16" };
const TILE_WIDTH_WIDEST = "w-19";

interface EpisodeGridProps {
  title: Pick<TitlePage, "slug" | "totalEpisodes" | "episodes">;
  now: Date;
  currentNumber: number;
}

/**
 * Серии рядом с плеером — сеткой плиток с номером, а не списком (правка владельца 2026-09-23):
 * рядом с плеером нужен переход к соседней серии, а название серии читают на странице тайтла.
 * Название здесь — в подписи ссылки и во всплывающей подсказке.
 *
 * Колонка липкая и не выше окна. У долгих тайтлов показывается окно вокруг текущей серии
 * (lib/episodes.ts), и оно честно пишет, какой диапазон показывает.
 *
 * Плотная поверхность, не стекло: под колонкой ничего нет (docs/04, «Стекло»).
 */
export function EpisodeGrid({ title, now, currentNumber }: EpisodeGridProps) {
  const { episodes: all, totalEpisodes, slug } = title;
  const { episodes, capped, first, last, total } = episodeWindow(all, currentNumber, WATCH_EPISODE_WINDOW);
  const count = totalEpisodes && totalEpisodes > total ? `${total} из ${totalEpisodes}` : String(total);

  const digits = formatEpisodeNumber(last).length;
  const width = TILE_WIDTH[digits] ?? TILE_WIDTH_WIDEST;

  // Как в списке на странице тайтла: помечаем серию без источника, только когда есть и подключённые.
  const markMissing = all.some((episode) => episode.hasSource) && all.some((episode) => !episode.hasSource);

  return (
    <section
      aria-labelledby="episodes-title"
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface lg:sticky lg:top-sticky lg:max-h-[calc(100dvh_-_var(--spacing-sticky)_-_1rem)]"
    >
      <div className="border-b border-line px-4 py-3">
        <SectionHeading id="episodes-title" tone="signal" aside={count}>
          Серии
        </SectionHeading>
      </div>

      <div className="min-h-0 overflow-y-auto p-4">
        <ol className="flex flex-wrap gap-1.5">
          {episodes.map((episode) => {
            const number = formatEpisodeNumber(episode.number);
            const current = episode.number === currentNumber;
            const missing = markMissing && !episode.hasSource;
            const fresh = !current && isFresh(episode.publishedAt, now);

            /*
             * Состояние задаёт форма, а не прозрачность (docs/04): текущая — янтарная заливка в
             * 14 процентов с янтарной границей, без источника — пунктирная рамка без заливки,
             * свежая — янтарная точка в углу. Пунктир остаётся и у текущей: плеер и так говорит,
             * что источника нет, но плитка не должна этому противоречить.
             */
            const state = current
              ? "border-signal-line bg-signal-soft text-signal"
              : missing
                ? "border-line text-muted hover:bg-surface-2 hover:text-text"
                : "border-line bg-fill text-text-2 hover:bg-fill-2 hover:text-text";

            return (
              <li key={episode.id}>
                <Link
                  href={episodeHref(slug, episode.number)}
                  aria-label={[
                    `Эпизод ${number}`,
                    episode.name,
                    fresh ? "новая" : null,
                    missing ? "источник не подключён" : null,
                    current ? "играет сейчас" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  aria-current={current ? "page" : undefined}
                  title={episode.name ?? undefined}
                  className={`relative flex h-11 ${width} items-center justify-center rounded-sm border font-display text-base font-semibold tabular-nums ${missing ? "border-dashed" : ""} ${state}`}
                >
                  {number}
                  {fresh && (
                    <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-signal" />
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      {(capped || markMissing) && (
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 text-xs text-dim">
          {capped && (
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span>
                Показаны{" "}
                <span data-numeric="">
                  {first}–{last}
                </span>{" "}
                из <span data-numeric="">{total}</span>
              </span>
              <Link href={titleHref(slug)} className={`${TEXT_LINK} inline-flex min-h-11 items-center text-sm`}>
                Все серии
              </Link>
            </p>
          )}
          {markMissing && <p>Серии в пунктирной рамке вышли, но источник к ним ещё не подключён.</p>}
        </div>
      )}
    </section>
  );
}

