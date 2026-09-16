import { getPlayback, type Playback } from "@/lib/playback/server";

import { getTitlePage, type TitleEpisode, type TitlePage } from "./title";

export interface WatchPage {
  title: TitlePage;
  episode: TitleEpisode;
  /** Соседние опубликованные серии: черновики между ними пропускаются. */
  previous: TitleEpisode | null;
  next: TitleEpisode | null;
  playback: Playback;
}

/** null — нет такого публичного тайтла или опубликованной серии с этим номером. */
export async function getWatchPage(slug: string, number: number): Promise<WatchPage | null> {
  // getTitlePage уже отфильтровал черновики и скрытые тайтлы и отдал только опубликованные серии.
  const title = await getTitlePage(slug);
  if (!title) return null;

  const index = title.episodes.findIndex((episode) => episode.number === number);
  const episode = title.episodes[index];
  if (!episode) return null;

  const playback = await getPlayback(episode.id);
  if (!playback) return null;

  return {
    title,
    episode,
    previous: title.episodes[index - 1] ?? null,
    next: title.episodes[index + 1] ?? null,
    playback,
  };
}
