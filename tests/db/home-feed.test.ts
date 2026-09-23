import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { TitleStatus } from "@/lib/generated/prisma/enums";
import { getHomeFeed, getOngoing, getPopular, getSchedule } from "@/lib/queries/home";

import { createEpisode, createTitle, hoursAgo } from "../factories/catalog";

function slugs(feed: Awaited<ReturnType<typeof getHomeFeed>>): string[] {
  return [feed.hero, ...feed.releases].map((release) => release?.title.slug ?? "нет героя");
}

describe("getHomeFeed", () => {
  it("пустая база — нет ни героя, ни ленты", async () => {
    expect(await getHomeFeed()).toEqual({ hero: null, releases: [] });
  });

  it("героем становится самая свежая серия, лента — по дате последней серии", async () => {
    const older = await createTitle({ slug: "older" });
    const newest = await createTitle({ slug: "newest" });
    const middle = await createTitle({ slug: "middle" });
    await createEpisode(older, { number: 1, publishedAt: hoursAgo(50) });
    await createEpisode(newest, { number: 1, publishedAt: hoursAgo(1) });
    await createEpisode(middle, { number: 1, publishedAt: hoursAgo(20) });

    expect(slugs(await getHomeFeed())).toEqual(["newest", "middle", "older"]);
  });

  it("один тайтл — одна карточка с его самой свежей серией", async () => {
    const ongoing = await createTitle({ slug: "ongoing" });
    const other = await createTitle({ slug: "other" });
    await createEpisode(other, { number: 1, publishedAt: hoursAgo(1) });
    for (const [number, hours] of [
      [1, 30],
      [2, 20],
      [3, 10],
    ] as const) {
      await createEpisode(ongoing, { number, publishedAt: hoursAgo(hours) });
    }

    const feed = await getHomeFeed();
    expect(slugs(feed)).toEqual(["other", "ongoing"]);
    expect(feed.releases[0]?.number).toBe(3);
  });

  it("пакетная публикация одного тайтла не вытесняет остальные", async () => {
    const batch = await createTitle({ slug: "batch" });
    const older = await createTitle({ slug: "older" });
    const oldest = await createTitle({ slug: "oldest" });
    await createEpisode(older, { number: 1, publishedAt: hoursAgo(100) });
    await createEpisode(oldest, { number: 1, publishedAt: hoursAgo(200) });
    // Больше, чем любое разумное окно последних серий, и все с одной датой, как при импорте.
    const publishedAt = hoursAgo(1);
    await prisma.episode.createMany({
      data: Array.from({ length: 61 }, (_, index) => ({ titleId: batch.id, number: index + 1, publishedAt })),
    });

    const feed = await getHomeFeed();
    expect(slugs(feed)).toEqual(["batch", "older", "oldest"]);
    expect(feed.hero?.number).toBe(61);
  });

  it("не больше двенадцати карточек после героя", async () => {
    for (let index = 0; index < 15; index += 1) {
      await createEpisode(await createTitle(), { publishedAt: hoursAgo(index + 1) });
    }
    expect((await getHomeFeed()).releases).toHaveLength(12);
  });

  describe("приватность (docs/07)", () => {
    // У каждой непубличной записи самая свежая серия: если фильтр сломан, она вылезет героем.
    it("черновик серии не попадает на главную", async () => {
      const title = await createTitle({ slug: "public" });
      await createEpisode(title, { number: 1, publishedAt: hoursAgo(5) });
      await createEpisode(title, { number: 2, publishedAt: null });

      const feed = await getHomeFeed();
      expect(feed.hero).toMatchObject({ number: 1, title: { slug: "public" } });
      expect(feed.releases).toEqual([]);
    });

    it("опубликованная серия черновика тайтла не попадает на главную", async () => {
      const draft = await createTitle({ slug: "draft", publishedAt: null });
      const visible = await createTitle({ slug: "visible" });
      await createEpisode(draft, { publishedAt: hoursAgo(1) });
      await createEpisode(visible, { publishedAt: hoursAgo(5) });

      expect(slugs(await getHomeFeed())).toEqual(["visible"]);
    });

    it("тайтл, скрытый по жалобе, пропадает вместе со всеми сериями", async () => {
      const hidden = await createTitle({ slug: "hidden", status: TitleStatus.HIDDEN });
      const visible = await createTitle({ slug: "visible" });
      await createEpisode(hidden, { publishedAt: hoursAgo(1) });
      await createEpisode(hidden, { publishedAt: hoursAgo(2) });
      await createEpisode(visible, { publishedAt: hoursAgo(5) });

      expect(slugs(await getHomeFeed())).toEqual(["visible"]);
    });
  });
});

describe("getOngoing", () => {
  it("только публичные онгоинги, по популярности, с числом вышедших серий и общим счётом", async () => {
    const popular = await createTitle({ slug: "popular", status: TitleStatus.ONGOING, popularityRank: 3 });
    await createTitle({ slug: "unranked", status: TitleStatus.ONGOING, popularityRank: null });
    await createTitle({ slug: "top", status: TitleStatus.ONGOING, popularityRank: 1 });
    await createTitle({ slug: "done", status: TitleStatus.COMPLETED, popularityRank: 2 });
    await createTitle({ slug: "draft", status: TitleStatus.ONGOING, publishedAt: null });
    await createEpisode(popular, { number: 1 });
    await createEpisode(popular, { number: 2 });
    await createEpisode(popular, { number: 3, publishedAt: null });

    const { titles, total } = await getOngoing(2);
    expect(titles.map((title) => title.slug)).toEqual(["top", "popular"]);
    expect(titles.find((title) => title.slug === "popular")?.published).toBe(2);
    // Счёт — по всем онгоингам, а не по показанному ряду; черновик и завершённый не в счёт.
    expect(total).toBe(3);
  });
});

describe("getPopular", () => {
  it("по месту у Shikimori; тайтл без места сюда не попадает", async () => {
    await createTitle({ slug: "second", popularityRank: 2 });
    await createTitle({ slug: "first", popularityRank: 1 });
    await createTitle({ slug: "no-rank", popularityRank: null });
    await createTitle({ slug: "hidden", popularityRank: 0, status: TitleStatus.HIDDEN });

    expect((await getPopular(5)).map((title) => [title.slug, title.popularityRank])).toEqual([
      ["first", 1],
      ["second", 2],
    ]);
  });
});

describe("getSchedule", () => {
  it("группирует онгоинги по дню выхода; без дня и не онгоинги — мимо", async () => {
    await createTitle({ slug: "thu", status: TitleStatus.ONGOING, airDay: 4, popularityRank: 2 });
    await createTitle({ slug: "thu-top", status: TitleStatus.ONGOING, airDay: 4, popularityRank: 1 });
    await createTitle({ slug: "mon", status: TitleStatus.ONGOING, airDay: 1 });
    await createTitle({ slug: "no-day", status: TitleStatus.ONGOING, airDay: null });
    await createTitle({ slug: "done", status: TitleStatus.COMPLETED, airDay: 4 });

    const schedule = await getSchedule();
    expect([...schedule.keys()].sort()).toEqual([1, 4]);
    expect(schedule.get(4)?.map((title) => title.slug)).toEqual(["thu-top", "thu"]);
  });
});
