import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { EpisodeList } from "@/components/title/episode-list";
import { AddToList } from "@/components/ui/add-to-list";
import { PlayerSlot } from "@/components/watch/player-slot";
import { formatDuration, formatEpisodeNumber, formatRelativeDate } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
import type { TitleEpisode } from "@/lib/queries/title";
import { getWatchPage } from "@/lib/queries/watch";
import { episodeHref, titleHref } from "@/lib/routes";

// docs/02, «Кеширование»: страница просмотра динамическая — скрытие тайтла по жалобе должно действовать сразу.
export const dynamic = "force-dynamic";

/** Номер серии из URL — внешний вход: «03», «-1», «1.5» и мусор — «не найдено». */
const episodeNumberSchema = z
  .string()
  .regex(/^[1-9]\d{0,4}$/)
  .transform(Number);

async function load(params: PageProps<"/anime/[slug]/[episode]">["params"]) {
  const { slug, episode } = await params;
  const number = episodeNumberSchema.safeParse(episode);
  return number.success ? getWatchPage(slug, number.data) : null;
}

export async function generateMetadata({ params }: PageProps<"/anime/[slug]/[episode]">): Promise<Metadata> {
  const page = await load(params);
  if (!page) return {};
  const { title, episode } = page;
  return {
    title: title.kind === TitleKind.MOVIE ? title.nameRu : `${title.nameRu} — эпизод ${episode.number}`,
    description: `Смотреть ${title.nameRu} онлайн на AnimeWatch`,
  };
}

/**
 * Просмотр по Watch.dc.html. Обсуждения под плеером с макета здесь нет: у него своя задача с
 * модерацией, и без аккаунтов лента была бы выдуманной.
 */
export default async function WatchPage({ params }: PageProps<"/anime/[slug]/[episode]">) {
  const page = await load(params);
  if (!page) notFound();

  const { title, episode, previous, next, source } = page;
  const isMovie = title.kind === TitleKind.MOVIE;
  const now = new Date();

  // Для пустого состояния плеера: куда вести вместо этой серии и сколько подключено вообще.
  const connected = title.episodes.filter((item) => item.hasSource).length;
  const playable =
    title.episodes.find((item) => item.hasSource && item.number > episode.number) ??
    title.episodes.find((item) => item.hasSource && item.number !== episode.number);

  const released = [
    `вышел ${formatRelativeDate(episode.publishedAt, now)}`,
    episode.duration ? formatDuration(episode.duration) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-6xl sm:px-4 sm:py-6">
      <div className="grid grid-cols-1 gap-x-7 gap-y-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <PlayerSlot
            source={source}
            titleName={title.nameRu}
            posterUrl={title.posterUrl}
            titleHref={titleHref(title.slug)}
            nextPlayable={playable ? { number: playable.number, href: episodeHref(title.slug, playable.number) } : null}
            connected={connected}
            published={title.episodes.length}
          />

          <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 sm:px-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Link
                href={titleHref(title.slug)}
                className="inline-flex min-h-11 items-center self-start text-sm text-muted hover:text-text"
              >
                {title.nameRu}
              </Link>
              {/* Название серии рядом с номером, но вне заголовка: h1 — это «Эпизод 05», и только он. */}
              <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                <h1 className="font-display text-xl leading-tight font-bold tracking-tight sm:text-2xl">
                  {isMovie ? title.nameRu : `Эпизод ${formatEpisodeNumber(episode.number)}`}
                </h1>
                {!isMovie && episode.name && <p className="text-lg text-text-2">{episode.name}</p>}
              </div>
              <p className="text-sm text-dim">{released}</p>
            </div>
            <AddToList size="sm" />
          </div>

          {(previous || next) && (
            <nav aria-label="Соседние серии" className="grid grid-cols-2 gap-3 px-4 sm:px-0">
              {previous ? <Neighbour slug={title.slug} episode={previous} direction="prev" /> : <span />}
              {next && <Neighbour slug={title.slug} episode={next} direction="next" />}
            </nav>
          )}
        </div>

        {!isMovie && (
          <aside className="px-4 pb-6 sm:px-0">
            <EpisodeList
              title={title}
              now={now}
              currentNumber={episode.number}
              footer={
                connected > 0 && connected < title.episodes.length ? (
                  <p className="text-xs text-dim">
                    Серии с пометкой «не подключена» вышли, но источник к ним ещё не подключён.
                  </p>
                ) : undefined
              }
            />
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * Соседняя серия карточкой: номер и название видны до перехода, а не только слово «Дальше».
 * Плотная поверхность — под карточкой ничего нет.
 */
function Neighbour({ slug, episode, direction }: { slug: string; episode: TitleEpisode; direction: "prev" | "next" }) {
  const isNext = direction === "next";
  return (
    <Link
      href={episodeHref(slug, episode.number)}
      rel={direction}
      className={`flex min-h-17 min-w-0 items-center gap-3.5 rounded-md border border-line bg-surface px-4 py-2.5 hover:bg-surface-2 ${isNext ? "col-start-2 justify-end text-right" : ""}`}
    >
      {!isNext && <ChevronLeft aria-hidden="true" className="size-4.5 shrink-0 text-muted" />}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-dim">{isNext ? "Следующая" : "Предыдущая"}</span>
        <span className="truncate text-base font-medium">
          {formatEpisodeNumber(episode.number)}
          {episode.name ? `. ${episode.name}` : ""}
        </span>
      </span>
      {isNext && <ChevronRight aria-hidden="true" className="size-4.5 shrink-0 text-muted" />}
    </Link>
  );
}
