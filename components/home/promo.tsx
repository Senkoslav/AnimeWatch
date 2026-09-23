import Link from "next/link";

import { EpisodeFrame } from "@/components/home/episode-frame";
import { AddToList } from "@/components/ui/add-to-list";
import { button, TAG, TAG_SIGNAL } from "@/components/ui/controls";
import { PosterBackdrop } from "@/components/ui/poster-backdrop";
import { formatEpisodeNumber, formatRelativeDate, formatScore, isFresh } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
import { KIND_LABELS } from "@/lib/labels";
import type { Release } from "@/lib/queries/home";
import { episodeHref, titleHref } from "@/lib/routes";

interface PromoProps {
  release: Release;
  /** Другие свежие серии для панели справа. */
  latest: Release[];
  /** Все серии в панели вышли сегодня — тогда она так и называется. */
  allToday: boolean;
  now: Date;
}

/**
 * Промо — последний выпуск на сайте (Main.dc.html, Home-mobile.dc.html). Не слайдер: слайдеры на
 * телефоне никто не листает, а промо должно стоять на месте, пока человек решает.
 *
 * Фон — размытый постер этого же тайтла: цвет на первый экран приносит он, а не наша краска.
 */
export function Promo({ release, latest, allToday, now }: PromoProps) {
  const { title, number, name, publishedAt, thumbUrl } = release;
  const isMovie = title.kind === TitleKind.MOVIE;
  const fresh = isFresh(publishedAt, now);
  const released = formatRelativeDate(publishedAt, now);
  const episodeLabel = isMovie ? "Фильм" : `Эпизод ${formatEpisodeNumber(number)}`;

  return (
    <section aria-labelledby="promo-title" className="mx-auto max-w-6xl px-4 pt-4 md:pt-6">
      <div className="relative overflow-hidden rounded-xl border border-line">
        <PosterBackdrop src={title.posterUrl} className="inset-0" />

        <div className="relative grid gap-6 p-4 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-10 lg:p-10">
          <div className="flex min-w-0 flex-col gap-4">
            <h2
              id="promo-title"
              className="font-display text-2xl leading-tight font-bold tracking-tight text-balance hyphens-auto md:text-4xl"
            >
              {title.nameRu}
            </h2>
            {title.name !== title.nameRu && <p className="-mt-2 text-sm text-muted">{title.name}</p>}

            <ul aria-label="Коротко" className="flex flex-wrap gap-2">
              <li className={TAG}>{episodeLabel}</li>
              <li className={TAG}>{[KIND_LABELS[title.kind], title.year].filter(Boolean).join(", ")}</li>
              {/* Янтарь — только у свежего: вышедшее позавчера уже не «сейчас». */}
              <li className={fresh ? TAG_SIGNAL : TAG}>
                {fresh && <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />}
                вышло <time dateTime={publishedAt.toISOString()}>{released}</time>
              </li>
              {title.score !== null && (
                <li className={TAG_SIGNAL}>
                  <span data-numeric="">{formatScore(title.score)}</span>
                  <span className="font-medium text-signal-muted">Shikimori</span>
                </li>
              )}
            </ul>

            {title.description && <p className="line-clamp-3 max-w-[62ch] text-md text-text-2">{title.description}</p>}

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Link href={episodeHref(title.slug, number)} className={`${button()} max-sm:w-full`}>
                <PlayIcon />
                Смотреть
              </Link>
              <AddToList />
              <Link href={titleHref(title.slug)} className={button("quiet")}>
                О тайтле
              </Link>
            </div>
          </div>

          {/* На телефоне кадр идёт первым (Home-mobile.dc.html): он и есть то, ради чего пришли. */}
          <div className="order-first flex min-w-0 flex-col gap-3 lg:order-none">
            <Link
              href={episodeHref(title.slug, number)}
              aria-label={`${title.nameRu}, ${episodeLabel}, смотреть`}
              className="group block rounded-lg"
            >
              <EpisodeFrame
                thumbUrl={thumbUrl}
                posterUrl={title.posterUrl}
                sizes="(min-width: 1024px) 432px, calc(100vw - 2rem)"
                posterSizes="(min-width: 1024px) 162px, 38vw"
                eager
                className="rounded-lg"
              >
                {!isMovie && (
                  // Номер на стекле с тёмной основой: у настоящего кадра светлый край, и без подложки номер пропал бы.
                  <span className="glass-panel absolute right-3 bottom-3 rounded-sm border border-line bg-bg/65 px-2.5 py-1.5 font-display text-2xl leading-none font-bold tracking-tight text-text">
                    {formatEpisodeNumber(number)}
                  </span>
                )}
                {name && (
                  <span className="glass-panel absolute top-3 right-3 max-w-[60%] truncate rounded-sm border border-line bg-bg/65 px-2.5 py-1 text-xs text-text-2">
                    {name}
                  </span>
                )}
                {/* Стекло над кадром: под кнопкой реально есть картинка, и она её размывает. */}
                <span className="glass-panel absolute top-1/2 left-1/2 inline-flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-fill-2 bg-bg/55 text-text group-hover:bg-bg/70">
                  <PlayIcon className="ml-0.5 size-5" />
                </span>
              </EpisodeFrame>
            </Link>

            {latest.length > 0 && (
              // Панель второго уровня стекла: блок поверх промо, под ним размытый постер (docs/04, «Стекло»).
              <div className="glass-panel hidden overflow-hidden rounded-lg border border-line lg:block">
                <p className="flex min-h-11 items-center border-b border-line px-4 text-sm font-semibold text-text-2">
                  {allToday ? "Вышло сегодня" : "Недавно вышло"}
                </p>
                <ol>
                  {latest.map((item) => (
                    <li key={item.episodeId} className="border-b border-line last:border-b-0">
                      <Link
                        href={episodeHref(item.title.slug, item.number)}
                        className="row-ruled min-h-12 px-4 py-1.5 hover:bg-fill"
                      >
                        <span className="font-display text-sm font-semibold text-dim tabular-nums">
                          {item.title.kind === TitleKind.MOVIE ? "—" : formatEpisodeNumber(item.number)}
                        </span>
                        <span className="min-w-0 truncate text-base">{item.title.nameRu}</span>
                        <time dateTime={item.publishedAt.toISOString()} className="text-xs text-dim">
                          {formatRelativeDate(item.publishedAt, now)}
                        </time>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlayIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M7 4.5l13 7.5-13 7.5z" />
    </svg>
  );
}
