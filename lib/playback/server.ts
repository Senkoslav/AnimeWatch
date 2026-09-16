/**
 * Выдача подписанного URL плейлиста. Модуль серверный: ключ подписи Bunny не должен попасть в клиентский бандл.
 */
import "server-only";

import { signedPlaylistUrl } from "@/lib/bunny/sign";
import { prisma } from "@/lib/db";
import { publicEpisodeWhere } from "@/lib/public-where";

import { pickSource, playbackTtlSeconds } from "./policy";

export type Playback =
  | { status: "ready"; src: string; /** unix-время в секундах */ expiresAt: number }
  /** Серия опубликована, но видео ещё не доехало до Bunny. */
  | { status: "processing" };

/** null — серии нет или зритель не должен её видеть (черновик, тайтл скрыт). */
export async function getPlayback(episodeId: string, now: number = Date.now()): Promise<Playback | null> {
  const episode = await prisma.episode.findFirst({
    where: { AND: [{ id: episodeId }, publicEpisodeWhere()] },
    select: { duration: true, sources: { select: { type: true, url: true, isDefault: true, priority: true } } },
  });
  if (!episode) return null;

  const source = pickSource(episode.sources);
  if (!source) return { status: "processing" };

  // Env читаем при вызове, а не при импорте: сборка и страницы без видео не должны падать без ключей Bunny.
  const hostname = process.env.BUNNY_CDN_HOSTNAME;
  const securityKey = process.env.BUNNY_TOKEN_KEY;
  if (!hostname || !securityKey) {
    throw new Error("BUNNY_CDN_HOSTNAME или BUNNY_TOKEN_KEY не заданы: без них нельзя подписать URL плейлиста");
  }

  const expiresAt = Math.floor(now / 1000) + playbackTtlSeconds(episode.duration);
  return {
    status: "ready",
    src: signedPlaylistUrl({ hostname, securityKey, videoId: source.url, expiresAt }),
    expiresAt,
  };
}
