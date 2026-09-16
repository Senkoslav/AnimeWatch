import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { TitleStatus } from "@/lib/generated/prisma/enums";
import { publicEpisodeWhere, publicTitleWhere } from "@/lib/public-where";

import { createEpisode, createTitle } from "../factories/catalog";

// Фильтры проверяются на базе, а не по форме объекта: на них стоит вся публичная выдача,
// и запросы поверх них могут сами по себе случайно прятать утечку.
describe("publicTitleWhere", () => {
  it("пропускает только опубликованные и не скрытые тайтлы", async () => {
    await createTitle({ slug: "public" });
    await createTitle({ slug: "draft", publishedAt: null });
    await createTitle({ slug: "hidden", status: TitleStatus.HIDDEN });
    await createTitle({ slug: "announced", status: TitleStatus.ANNOUNCED });

    const titles = await prisma.title.findMany({ where: publicTitleWhere(), select: { slug: true } });
    expect(titles.map(({ slug }) => slug).sort()).toEqual(["announced", "public"]);
  });
});

describe("publicEpisodeWhere", () => {
  it("пропускает опубликованные серии публичных тайтлов", async () => {
    const visible = await createTitle({ slug: "public" });
    const draftTitle = await createTitle({ slug: "draft", publishedAt: null });
    const hidden = await createTitle({ slug: "hidden", status: TitleStatus.HIDDEN });
    await createEpisode(visible, { number: 1 });
    await createEpisode(visible, { number: 2, publishedAt: null });
    await createEpisode(draftTitle, { number: 1 });
    await createEpisode(hidden, { number: 1 });

    const episodes = await prisma.episode.findMany({
      where: publicEpisodeWhere(),
      select: { number: true, title: { select: { slug: true } } },
    });
    expect(episodes).toEqual([{ number: 1, title: { slug: "public" } }]);
  });
});
