import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { EpisodePlayer } from "@/components/player/episode-player";
import { EpisodeList } from "@/components/title/episode-list";
import { formatEpisodeNumber } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
import { getWatchPage } from "@/lib/queries/watch";
import { episodeHref, titleHref } from "@/lib/routes";

// docs/02, «Кеширование»: страница просмотра динамическая — подписанный URL короткоживущий и не должен лечь в кеш.
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
    description: `Смотреть ${title.nameRu} в озвучке BebraDub`,
  };
}

export default async function WatchPage({ params }: PageProps<"/anime/[slug]/[episode]">) {
  const page = await load(params);
  if (!page) notFound();

  const { title, episode, previous, next, playback } = page;
  const isMovie = title.kind === TitleKind.MOVIE;
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl sm:px-4 sm:py-6">
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {playback.status === "ready" ? (
            <EpisodePlayer
              key={episode.id}
              episodeId={episode.id}
              src={playback.src}
              next={
                next
                  ? {
                      episodeId: next.id,
                      href: episodeHref(title.slug, next.number),
                      label: `Эпизод ${formatEpisodeNumber(next.number)}`,
                    }
                  : null
              }
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-surface p-6 text-center sm:rounded-md">
              <p className="max-w-[40ch]">Серия ещё обрабатывается, обычно это занимает 10–15 минут.</p>
            </div>
          )}

          <div className="space-y-2 px-4 sm:px-0">
            <Link
              href={titleHref(title.slug)}
              className="inline-flex min-h-11 items-center text-sm text-muted underline"
            >
              {title.nameRu}
            </Link>
            <h1 className="text-xl leading-tight font-semibold">
              {isMovie ? title.nameRu : `Эпизод ${formatEpisodeNumber(episode.number)}`}
            </h1>
            {!isMovie && episode.name && <p className="text-muted">{episode.name}</p>}
          </div>

          {(previous || next) && (
            <nav aria-label="Соседние серии" className="flex justify-between gap-4 px-4 sm:px-0">
              {previous ? (
                <Link
                  href={episodeHref(title.slug, previous.number)}
                  rel="prev"
                  className="inline-flex min-h-11 items-center rounded-sm border border-line px-4 text-sm hover:bg-surface-2"
                >
                  Предыдущая
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={episodeHref(title.slug, next.number)}
                  rel="next"
                  className="inline-flex min-h-11 items-center rounded-sm border border-line px-4 text-sm hover:bg-surface-2"
                >
                  Следующая
                </Link>
              )}
            </nav>
          )}
        </div>

        {!isMovie && (
          <aside className="px-4 pb-6 sm:px-0">
            <EpisodeList title={title} now={now} currentNumber={episode.number} />
          </aside>
        )}
      </div>
    </div>
  );
}
