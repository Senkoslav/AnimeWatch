/**
 * Фабрики тайтлов и серий для тестов с базой. Умолчания — публичные записи:
 * тест явно пишет то, что делает запись непубличной.
 */
import { prisma } from "@/lib/db";
import type { Episode, Prisma, Title } from "@/lib/generated/prisma/client";

let sequence = 0;
const HOUR = 60 * 60 * 1000;

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * HOUR);
}

export async function createTitle(overrides: Partial<Prisma.TitleCreateInput> = {}): Promise<Title> {
  sequence += 1;
  return prisma.title.create({
    data: {
      slug: `title-${sequence}`,
      name: `Title ${sequence}`,
      nameRu: `Тайтл ${sequence}`,
      publishedAt: hoursAgo(1000),
      ...overrides,
    },
  });
}

export async function createEpisode(
  title: Pick<Title, "id">,
  overrides: Partial<Omit<Prisma.EpisodeUncheckedCreateInput, "titleId">> = {},
): Promise<Episode> {
  sequence += 1;
  return prisma.episode.create({
    data: { titleId: title.id, number: sequence, publishedAt: hoursAgo(10), ...overrides },
  });
}
