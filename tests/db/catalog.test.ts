import { describe, expect, it } from "vitest";

import type { CatalogParams } from "@/lib/catalog/params";
import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";
import { CATALOG_PAGE_SIZE, getCatalog, getCatalogFilters } from "@/lib/queries/catalog";

import { createTitle, hoursAgo } from "../factories/catalog";

const defaults: CatalogParams = { sort: "new", page: 1 };

async function slugs(params: Partial<CatalogParams> = {}): Promise<string[]> {
  const { items } = await getCatalog({ ...defaults, ...params });
  return items.map((item) => item.slug);
}

describe("getCatalog", () => {
  it("фильтрует по жанру, году, статусу и типу по отдельности и вместе", async () => {
    await createTitle({ slug: "drama-tv-2023", genres: ["Драма", "Фэнтези"], year: 2023, kind: TitleKind.TV });
    await createTitle({ slug: "drama-movie-2016", genres: ["Драма"], year: 2016, kind: TitleKind.MOVIE });
    await createTitle({
      slug: "action-tv-2023-completed",
      genres: ["Экшен"],
      year: 2023,
      kind: TitleKind.TV,
      status: TitleStatus.COMPLETED,
    });

    expect((await slugs({ genre: "Драма" })).sort()).toEqual(["drama-movie-2016", "drama-tv-2023"]);
    expect((await slugs({ year: 2023 })).sort()).toEqual(["action-tv-2023-completed", "drama-tv-2023"]);
    expect(await slugs({ status: TitleStatus.COMPLETED })).toEqual(["action-tv-2023-completed"]);
    expect(await slugs({ kind: TitleKind.MOVIE })).toEqual(["drama-movie-2016"]);
    expect(await slugs({ genre: "Драма", year: 2023, kind: TitleKind.TV })).toEqual(["drama-tv-2023"]);
    expect(await slugs({ genre: "Комедия" })).toEqual([]);
  });

  it("сортирует: недавно добавленные, по году (без года в конце), по названию", async () => {
    await createTitle({ slug: "b", nameRu: "Бета", year: 2010, publishedAt: hoursAgo(30) });
    await createTitle({ slug: "a", nameRu: "Альфа", year: null, publishedAt: hoursAgo(10) });
    await createTitle({ slug: "v", nameRu: "Вега", year: 2020, publishedAt: hoursAgo(20) });

    expect(await slugs({ sort: "new" })).toEqual(["a", "v", "b"]);
    expect(await slugs({ sort: "year" })).toEqual(["v", "b", "a"]);
    expect(await slugs({ sort: "name" })).toEqual(["a", "b", "v"]);
  });

  it("пагинация без дублей и пропусков, даже при одинаковой дате", async () => {
    const publishedAt = hoursAgo(5);
    for (let index = 0; index < CATALOG_PAGE_SIZE + 6; index += 1) {
      await createTitle({ publishedAt });
    }

    const first = await getCatalog({ ...defaults, page: 1 });
    const second = await getCatalog({ ...defaults, page: 2 });
    const third = await getCatalog({ ...defaults, page: 3 });

    expect(first).toMatchObject({ total: 30, pageCount: 2 });
    expect(first.items).toHaveLength(CATALOG_PAGE_SIZE);
    expect(second.items).toHaveLength(6);
    expect(third.items).toEqual([]);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(30);
  });

  it("пустой каталог — одна пустая страница", async () => {
    expect(await getCatalog(defaults)).toEqual({ items: [], total: 0, pageCount: 1 });
  });

  describe("приватность (docs/07)", () => {
    it("черновик и скрытый тайтл не попадают ни в выдачу, ни в счётчик, даже под своими фильтрами", async () => {
      await createTitle({ slug: "public", genres: ["Драма"], year: 2023 });
      await createTitle({ slug: "draft", genres: ["Драма"], year: 2023, publishedAt: null });
      await createTitle({ slug: "hidden", genres: ["Драма"], year: 2023, status: TitleStatus.HIDDEN });

      const catalog = await getCatalog({ ...defaults, genre: "Драма", year: 2023 });
      expect(catalog.items.map((item) => item.slug)).toEqual(["public"]);
      expect(catalog.total).toBe(1);
    });
  });
});

describe("getCatalogFilters", () => {
  it("жанры без повторов по алфавиту, годы по убыванию, без пустых", async () => {
    await createTitle({ genres: ["Фэнтези", "Драма"], year: 2016 });
    await createTitle({ genres: ["Драма", "Экшен"], year: 2023 });
    await createTitle({ genres: [], year: null });

    expect(await getCatalogFilters()).toEqual({ genres: ["Драма", "Фэнтези", "Экшен"], years: [2023, 2016] });
  });

  it("жанры и годы непубличных тайтлов в фильтры не попадают", async () => {
    await createTitle({ genres: ["Драма"], year: 2023 });
    await createTitle({ genres: ["Меха"], year: 1999, publishedAt: null });
    await createTitle({ genres: ["Хоррор"], year: 1998, status: TitleStatus.HIDDEN });

    expect(await getCatalogFilters()).toEqual({ genres: ["Драма"], years: [2023] });
  });
});
