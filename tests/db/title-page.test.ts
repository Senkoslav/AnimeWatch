import { describe, expect, it } from "vitest";

import { TitleStatus } from "@/lib/generated/prisma/enums";
import { getTitlePage } from "@/lib/queries/title";

import { createEpisode, createTitle } from "../factories/catalog";

describe("getTitlePage", () => {
  it("отдаёт тайтл с опубликованными сериями по номеру", async () => {
    const title = await createTitle({ slug: "frieren", nameRu: "Фрирен", genres: ["Драма"] });
    await createEpisode(title, { number: 2, name: "Вторая" });
    await createEpisode(title, { number: 1, name: "Первая" });
    await createEpisode(title, { number: 3, publishedAt: null });

    const page = await getTitlePage("frieren");
    expect(page).toMatchObject({ slug: "frieren", nameRu: "Фрирен", genres: ["Драма"] });
    expect(page?.episodes.map((episode) => [episode.number, episode.name])).toEqual([
      [1, "Первая"],
      [2, "Вторая"],
    ]);
  });

  it("несуществующий slug и мусор вместо slug — null, без ошибки базы", async () => {
    expect(await getTitlePage("net-takogo")).toBeNull();
    expect(await getTitlePage("\u0000")).toBeNull();
    expect(await getTitlePage("Frieren")).toBeNull();
  });

  describe("приватность (docs/07)", () => {
    it("черновик тайтла — null, даже с опубликованными сериями", async () => {
      const draft = await createTitle({ slug: "draft", publishedAt: null });
      await createEpisode(draft);
      expect(await getTitlePage("draft")).toBeNull();
    });

    it("тайтл, скрытый по жалобе, — null", async () => {
      const hidden = await createTitle({ slug: "hidden", status: TitleStatus.HIDDEN });
      await createEpisode(hidden);
      expect(await getTitlePage("hidden")).toBeNull();
    });
  });
});
