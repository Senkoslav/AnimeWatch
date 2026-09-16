import { prisma } from "@/lib/db";
import type { TitleKind } from "@/lib/generated/prisma/enums";
import { publicEpisodeWhere } from "@/lib/public-where";
import { isDefined } from "@/lib/unknown";

/** Карточек в ленте «Свежее», не считая героя. */
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
  // Одна строка на тайтл считается в базе: пакетная публикация (импорт, дюжина серий разом) иначе вытеснила бы
  // остальные тайтлы из окна последних серий. titleId в сортировке — чтобы герой не прыгал при равных датах.
  const latestByTitle = await prisma.episode.groupBy({
    by: ["titleId"],
    where: publicEpisodeWhere(),
    _max: { publishedAt: true },
    orderBy: [{ _max: { publishedAt: "desc" } }, { titleId: "asc" }],
    take: FEED_SIZE + 1,
  });
  if (latestByTitle.length === 0) {
    return { hero: null, releases: [] };
  }

  const episodes = await prisma.episode.findMany({
    where: {
      AND: [
        publicEpisodeWhere(),
        { OR: latestByTitle.map(({ titleId, _max }) => ({ titleId, publishedAt: _max.publishedAt })) },
      ],
    },
    // Несколько серий тайтла вышли одновременно: показываем старшую.
    orderBy: { number: "desc" },
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

  const byTitle = new Map<string, Release>();
  for (const { id, titleId, publishedAt, ...episode } of episodes) {
    if (publishedAt === null || byTitle.has(titleId)) continue;
    byTitle.set(titleId, { ...episode, episodeId: id, publishedAt });
  }

  const [hero = null, ...releases] = latestByTitle.map(({ titleId }) => byTitle.get(titleId)).filter(isDefined);
  return { hero, releases };
}
