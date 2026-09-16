import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { TitleStatus } from "@/lib/generated/prisma/enums";
import { getHomeFeed } from "@/lib/queries/home";

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
