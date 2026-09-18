import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { TitleStatus } from "@/lib/generated/prisma/enums";
import { importTitles, resetPopularityRanks } from "@/lib/shikimori/import";
import { animeNodeSchema, type AnimeNode } from "@/lib/shikimori/schema";

function node(overrides: Record<string, unknown> = {}): AnimeNode {
  return animeNodeSchema.parse({
    id: "16498",
    name: "Shingeki no Kyojin",
    russian: "Атака титанов",
    english: "Attack on Titan",
    kind: "tv",
    status: "released",
    episodes: 3,
    episodesAired: 0,
    duration: 24,
    airedOn: { year: 2013 },
    genres: [{ russian: "Экшен" }],
    poster: { originalUrl: "https://shikimori.io/uploads/poster/animes/16498/a.jpeg" },
    ...overrides,
  });
}

async function titleBySlug(slug: string) {
  return prisma.title.findUnique({
    where: { slug },
    select: { id: true, shikimoriId: true, status: true, publishedAt: true, nameRu: true, genres: true },
  });
}

describe("importTitles", () => {
  it("заводит тайтл с сериями и публикует его", async () => {
    const now = new Date("2026-09-18T10:00:00Z");
    const stats = await importTitles(prisma, [node()], now);

    expect(stats).toMatchObject({ created: 1, updated: 0, episodesCreated: 3, skipped: 0 });
    const title = await titleBySlug("attack-on-titan");
    expect(title).toMatchObject({ shikimoriId: 16498, nameRu: "Атака титанов", publishedAt: now });

    const episodes = await prisma.episode.findMany({ where: { titleId: title?.id }, orderBy: { number: "asc" } });
    expect(episodes.map((episode) => episode.number)).toEqual([1, 2, 3]);
    // Длительность у них в минутах, у нас в секундах.
    expect(episodes[0]?.duration).toBe(24 * 60);
  });

  it("повторный импорт не плодит записи и не переставляет даты", async () => {
    const first = new Date("2026-09-18T10:00:00Z");
    await importTitles(prisma, [node()], first);

    const later = new Date("2026-09-20T10:00:00Z");
    const stats = await importTitles(prisma, [node({ russian: "Атака титанов: новое имя" })], later);

    expect(stats).toMatchObject({ created: 0, updated: 1, episodesCreated: 0 });
    expect(await prisma.title.count()).toBe(1);
    expect(await prisma.episode.count()).toBe(3);

    const title = await titleBySlug("attack-on-titan");
    // Метаданные обновились, а дата появления у нас осталась прежней.
    expect(title?.nameRu).toBe("Атака титанов: новое имя");
    expect(title?.publishedAt).toEqual(first);
  });

  it("новые вышедшие серии добавляются к существующим", async () => {
    await importTitles(prisma, [node({ status: "ongoing", episodes: 0, episodesAired: 2 })]);
    const stats = await importTitles(prisma, [node({ status: "ongoing", episodes: 0, episodesAired: 4 })]);

    expect(stats.episodesCreated).toBe(2);
    expect(await prisma.episode.count()).toBe(4);
  });

  it("выходящему тайтлу не заводятся серии вперёд вышедших", async () => {
    await importTitles(prisma, [node({ status: "ongoing", episodes: 24, episodesAired: 5 })]);
    expect(await prisma.episode.count()).toBe(5);
  });

  describe("приватность (docs/07)", () => {
    it("скрытый по жалобе тайтл повторный импорт не возвращает на сайт", async () => {
      await importTitles(prisma, [node()]);
      const before = await titleBySlug("attack-on-titan");
      await prisma.title.update({ where: { id: before?.id }, data: { status: TitleStatus.HIDDEN } });

      await importTitles(prisma, [node()]);

      expect((await titleBySlug("attack-on-titan"))?.status).toBe(TitleStatus.HIDDEN);
    });

    it("черновик остаётся черновиком", async () => {
      await importTitles(prisma, [node()]);
      const created = await titleBySlug("attack-on-titan");
      await prisma.title.update({ where: { id: created?.id }, data: { publishedAt: null } });

      await importTitles(prisma, [node()]);

      expect((await titleBySlug("attack-on-titan"))?.publishedAt).toBeNull();
    });
  });

  describe("место по популярности", () => {
    it("проставляется из карты, а тайтл вне её своего места не получает", async () => {
      await importTitles(prisma, [node(), node({ id: "2" })], new Date(), new Map([[16498, 7]]));

      const ranked = await prisma.title.findUnique({ where: { shikimoriId: 16498 }, select: { popularityRank: true } });
      const unranked = await prisma.title.findUnique({ where: { shikimoriId: 2 }, select: { popularityRank: true } });
      expect(ranked?.popularityRank).toBe(7);
      expect(unranked?.popularityRank).toBeNull();
    });

    it("повторный импорт по id место не стирает: его знает только пакетный проход", async () => {
      await importTitles(prisma, [node()], new Date(), new Map([[16498, 7]]));
      await importTitles(prisma, [node()]);

      const title = await prisma.title.findUnique({ where: { shikimoriId: 16498 }, select: { popularityRank: true } });
      expect(title?.popularityRank).toBe(7);
    });

    it("сброс снимает места у всех: выпавший из топа не должен висеть в его голове", async () => {
      await importTitles(
        prisma,
        [node(), node({ id: "2" })],
        new Date(),
        new Map([
          [16498, 7],
          [2, 8],
        ]),
      );

      expect(await resetPopularityRanks(prisma)).toBe(2);
      expect(await prisma.title.count({ where: { popularityRank: { not: null } } })).toBe(0);
    });
  });

  describe("отбраковка и коллизии", () => {
    it("клипы и реклама в каталог не попадают", async () => {
      const stats = await importTitles(prisma, [node({ kind: "music" }), node({ id: "2", kind: "cm" })]);

      expect(stats).toMatchObject({ created: 0, skipped: 2 });
      expect(await prisma.title.count()).toBe(0);
    });

    it("занятый slug не ломает импорт: второй тайтл получает свой", async () => {
      await prisma.title.create({ data: { slug: "attack-on-titan", name: "Чужой", nameRu: "Чужой" } });

      await importTitles(prisma, [node()]);

      const imported = await prisma.title.findUnique({ where: { shikimoriId: 16498 }, select: { slug: true } });
      expect(imported?.slug).toBe("attack-on-titan-2013");
    });
  });
});
