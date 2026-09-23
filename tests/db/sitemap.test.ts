import { describe, expect, it } from "vitest";

import { TitleStatus } from "@/lib/generated/prisma/enums";
import { getSitemapTitles } from "@/lib/queries/sitemap";

import { createTitle } from "../factories/catalog";

describe("getSitemapTitles", () => {
  it("только публичные тайтлы: черновик и скрытый по жалобе в карту не попадают", async () => {
    await createTitle({ slug: "public-title" });
    await createTitle({ slug: "draft", publishedAt: null });
    await createTitle({ slug: "hidden", status: TitleStatus.HIDDEN });

    const titles = await getSitemapTitles();
    expect(titles.map((title) => title.slug)).toEqual(["public-title"]);
    expect(titles[0]?.updatedAt).toBeInstanceOf(Date);
  });
});
