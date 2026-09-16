import { prisma } from "@/lib/db";
import type { TitleKind } from "@/lib/generated/prisma/enums";
import { publicEpisodeWhere } from "@/lib/public-where";

/** Сколько свежих серий читать, чтобы после свёртки по тайтлам набралась лента. */
const RECENT_EPISODES = 60;
const FEED_SIZE = 12;

export interface Release {
  episodeId: string;
  number: number;
  name: string | null;
  thumbUrl: string | null;
  publishedAt: Date;
  title: {
    slug: string;
    nameRu: string;
    posterUrl: string | null;
    kind: TitleKind;
  };
}

export interface HomeFeed {
  /** Самая свежая серия на сайте; null, если опубликованных серий нет. */
  hero: Release | null;
  /** Следующие тайтлы по дате последней серии, по одной карточке на тайтл. */
  releases: Release[];
}

export async function getHomeFeed(): Promise<HomeFeed> {
  const episodes = await prisma.episode.findMany({
    where: publicEpisodeWhere(),
    orderBy: [{ publishedAt: "desc" }, { number: "desc" }],
    take: RECENT_EPISODES,
    select: {
      id: true,
      titleId: true,
      number: true,
      name: true,
      thumbUrl: true,
      publishedAt: true,
      title: { select: { slug: true, nameRu: true, posterUrl: true, kind: true } },
    },
  });

  // Три серии одного онгоинга подряд заняли бы три карточки: оставляем самую свежую серию тайтла.
  const seen = new Set<string>();
  const latest: Release[] = [];
  for (const { id, titleId, publishedAt, ...episode } of episodes) {
    if (publishedAt === null || seen.has(titleId)) continue;
    seen.add(titleId);
    latest.push({ ...episode, episodeId: id, publishedAt });
  }

  const [hero = null, ...rest] = latest;
  return { hero, releases: rest.slice(0, FEED_SIZE) };
}
