import { cache } from "react";

import { prisma } from "@/lib/db";
import { SourceType } from "@/lib/generated/prisma/enums";

import { getTitlePage, type TitleEpisode, type TitlePage } from "./title";

export interface WatchSource {
  type: SourceType;
  url: string;
}

export interface WatchPage {
  title: TitlePage;
  episode: TitleEpisode;
  /** Соседние опубликованные серии: черновики между ними пропускаются. */
  previous: TitleEpisode | null;
  next: TitleEpisode | null;
  /** Фрейм Kodik. null — у серии его ещё нет: страница честно говорит об этом, а не отдаёт 404. */
  source: WatchSource | null;
}

/**
 * null — нет такого публичного тайтла или опубликованной серии с этим номером.
 * cache(): generateMetadata и страница в одном рендере делят один запрос.
 */
export const getWatchPage = cache(async (slug: string, number: number): Promise<WatchPage | null> => {
  // getTitlePage уже отфильтровал черновики и скрытые тайтлы и отдал только опубликованные серии.
  const title = await getTitlePage(slug);
  if (!title) return null;

  const index = title.episodes.findIndex((episode) => episode.number === number);
  const episode = title.episodes[index];
  if (!episode) return null;

  const source = await prisma.source.findFirst({
    // Только фрейм Kodik — по тому же правилу, что hasSource в getTitlePage: прямые файлы в этой
    // версии не играют. Иначе MP4 по умолчанию выигрывал бы у Kodik, и плеер говорил бы «не
    // подключён» рядом с плиткой той же серии, отмеченной подключённой.
    where: { episodeId: episode.id, type: SourceType.KODIK },
    // Сначала источник по умолчанию, затем по приоритету: смена поставщика видео не требует правок UI.
    orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
    select: { type: true, url: true },
  });

  return {
    title,
    episode,
    previous: title.episodes[index - 1] ?? null,
    next: title.episodes[index + 1] ?? null,
    source,
  };
});
