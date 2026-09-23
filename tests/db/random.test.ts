import { describe, expect, it } from "vitest";

import { TitleStatus } from "@/lib/generated/prisma/enums";
import { getRandomTitleSlug } from "@/lib/queries/random";

import { createTitle } from "../factories/catalog";

describe("getRandomTitleSlug", () => {
  it("пустой каталог — null, а не ошибка", async () => {
    expect(await getRandomTitleSlug()).toBeNull();
  });

  it("выдаёт только публичные: черновик и скрытый по жалобе не выпадают никогда", async () => {
    await createTitle({ slug: "public-a" });
    await createTitle({ slug: "public-b" });
    await createTitle({ slug: "draft", publishedAt: null });
    await createTitle({ slug: "hidden", status: TitleStatus.HIDDEN });

    const seen = new Set<string | null>();
    for (let attempt = 0; attempt < 40; attempt += 1) seen.add(await getRandomTitleSlug());

    expect([...seen].every((slug) => slug === "public-a" || slug === "public-b")).toBe(true);
    // За 40 попыток из двух вариантов оба выпадают почти наверняка (вероятность промаха 2⁻³⁹).
    expect(seen.size).toBe(2);
  });
});
