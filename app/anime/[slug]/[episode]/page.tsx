import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { EpisodeList } from "@/components/title/episode-list";
import { button } from "@/components/ui/controls";
import { PlayerSlot } from "@/components/watch/player-slot";
import { formatEpisodeNumber } from "@/lib/format";
import { TitleKind } from "@/lib/generated/prisma/enums";
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

export default async function WatchPage({ params }: PageProps<"/anime/[slug]/[episode]">) {
  const page = await load(params);
  if (!page) notFound();

  const { title, episode, previous, next, source } = page;
  const isMovie = title.kind === TitleKind.MOVIE;
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl sm:px-4 sm:py-6">
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <PlayerSlot source={source} titleName={title.nameRu} />

          <div className="space-y-2 px-4 sm:px-0">
            <Link
              href={titleHref(title.slug)}
              className="inline-flex min-h-11 items-center text-sm text-dim underline hover:text-text"
            >
              {title.nameRu}
            </Link>
            <h1 className="font-display text-xl leading-tight font-bold tracking-tight">
              {isMovie ? title.nameRu : `Эпизод ${formatEpisodeNumber(episode.number)}`}
            </h1>
            {!isMovie && episode.name && <p className="text-text-2">{episode.name}</p>}
          </div>

          {(previous || next) && (
            <nav aria-label="Соседние серии" className="flex justify-between gap-4 px-4 sm:px-0">
              {previous ? (
                <Link href={episodeHref(title.slug, previous.number)} rel="prev" className={button("secondary", "sm")}>
                  Предыдущая
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={episodeHref(title.slug, next.number)} rel="next" className={button("secondary", "sm")}>
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
