import { cache } from "react";

import { prisma } from "@/lib/db";
import { SourceType, type TitleKind, type TitleStatus } from "@/lib/generated/prisma/enums";
import { publicEpisodeWhere, publicTitleWhere } from "@/lib/public-where";
import { slugSchema } from "@/lib/slug";

export interface TitleEpisode {
  id: string;
  number: number;
  name: string | null;
  duration: number | null;
  /** Кадр из серии для строки списка; у импорта с Shikimori его обычно нет. */
  thumbUrl: string | null;
  publishedAt: Date;
  /**
   * Есть ли у серии источник, который реально играет: фрейм Kodik. Прямые файлы в этой версии не
   * воспроизводятся (components/watch/player-slot.tsx), и считать их «подключёнными» значило бы соврать.
   */
  hasSource: boolean;
}

export interface TitlePage {
  id: string;
  slug: string;
  name: string;
  nameRu: string;
  description: string | null;
  posterUrl: string | null;
  kind: TitleKind;
  status: TitleStatus;
  year: number | null;
  /** Оценка Shikimori. null — тайтл ещё никто не оценил, и значка на постере не будет. */
  score: number | null;
  /** Сырые значения Shikimori: «spring_2022», «pg_13». Подписи — lib/format.ts. */
  season: string | null;
  ageRating: string | null;
  /** День выхода, 1 — понедельник. Для подписи «остальные выйдут по четвергам». */
  airDay: number | null;
  genres: string[];
  totalEpisodes: number | null;
  episodes: TitleEpisode[];
}

/**
 * Публичный тайтл с опубликованными сериями; null — нет такого, черновик или скрыт по жалобе.
 * cache(): generateMetadata и страница в одном рендере делят один запрос.
 */
export const getTitlePage = cache(async (slug: string): Promise<TitlePage | null> => {
  // Slug из URL — внешний вход: мусор (в том числе \0, на котором Postgres ответил бы ошибкой) — сразу «не найдено».
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;

  const title = await prisma.title.findFirst({
    where: { AND: [{ slug: parsed.data }, publicTitleWhere()] },
    select: {
      id: true,
      slug: true,
      name: true,
      nameRu: true,
      description: true,
      posterUrl: true,
      kind: true,
      status: true,
      year: true,
      // Оценка Shikimori: значок на постере. null — тайтл ещё никто не оценил (docs/03).
      score: true,
      season: true,
      ageRating: true,
      airDay: true,
      genres: true,
      totalEpisodes: true,
      episodes: {
        where: publicEpisodeWhere(),
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          name: true,
          duration: true,
          thumbUrl: true,
          publishedAt: true,
          // Счётчик в том же запросе, а не запрос на серию: у «Ван-Пис» их больше тысячи.
          _count: { select: { sources: { where: { type: SourceType.KODIK } } } },
        },
      },
    },
  });
  if (!title) return null;

  return {
    ...title,
    episodes: title.episodes.flatMap(({ publishedAt, _count, ...episode }) =>
      publishedAt === null ? [] : [{ ...episode, publishedAt, hasSource: _count.sources > 0 }],
    ),
  };
});
