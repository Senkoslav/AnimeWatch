import { cache } from "react";

import { prisma } from "@/lib/db";
import type { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";
import { publicEpisodeWhere, publicTitleWhere } from "@/lib/public-where";
import { slugSchema } from "@/lib/slug";

export interface TitleEpisode {
  id: string;
  number: number;
  name: string | null;
  duration: number | null;
  publishedAt: Date;
}

export interface TitleCredit {
  id: string;
  role: string;
  isVoice: boolean;
  nickname: string;
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
  genres: string[];
  totalEpisodes: number | null;
  episodes: TitleEpisode[];
  credits: TitleCredit[];
}

/**
 * Публичный тайтл с опубликованными сериями и составом; null — нет, черновик или скрыт по жалобе.
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
      genres: true,
      totalEpisodes: true,
      episodes: {
        where: publicEpisodeWhere(),
        orderBy: { number: "asc" },
        select: { id: true, number: true, name: true, duration: true, publishedAt: true },
      },
      credits: {
        // Сначала голоса, затем остальные роли; внутри — порядок участников из раздела «Команда».
        orderBy: [{ isVoice: "desc" }, { member: { sortOrder: "asc" } }, { role: "asc" }],
        select: { id: true, role: true, isVoice: true, member: { select: { nickname: true } } },
      },
    },
  });
  if (!title) return null;

  return {
    ...title,
    episodes: title.episodes.flatMap(({ publishedAt, ...episode }) =>
      publishedAt === null ? [] : [{ ...episode, publishedAt }],
    ),
    credits: title.credits.map(({ member, ...credit }) => ({ ...credit, nickname: member.nickname })),
  };
});
