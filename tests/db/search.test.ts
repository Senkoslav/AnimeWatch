import { describe, expect, it } from "vitest";

import { TitleStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { publicTitleWhere } from "@/lib/public-where";
import { SEARCH_LIMIT, searchTitles } from "@/lib/queries/search";

import { createTitle } from "../factories/catalog";

async function slugs(query: string): Promise<string[]> {
  return (await searchTitles(query)).titles.map((title) => title.slug);
}

async function seedTitles() {
  await createTitle({ slug: "naruto", name: "Naruto", nameRu: "Наруто", synonyms: ["NARUTO"] });
  await createTitle({
    slug: "frieren",
    name: "Sousou no Frieren",
    nameRu: "Провожающая в последний путь Фрирен",
    synonyms: ["Фрирен", "Frieren: Beyond Journey's End"],
  });
  await createTitle({ slug: "dandadan", name: "Dandadan", nameRu: "Дандадан", synonyms: [] });
}

describe("searchTitles", () => {
  it("приёмка роадмапа: «наруот» находит «Наруто»", async () => {
    await seedTitles();
    expect(await slugs("наруот")).toContain("naruto");
  });

  it("точное слово находит длинное название, где similarity размывается", async () => {
    await seedTitles();
    expect(await slugs("фрирен")).toEqual(["frieren"]);
  });

  it("опечатка внутри слова и в длинном названии", async () => {
    await seedTitles();
    expect(await slugs("дандаадн")).toEqual(["dandadan"]);
    expect(await slugs("фиррен")).toContain("frieren");
  });

  it("находит по оригинальному названию и по синониму", async () => {
    await seedTitles();
    expect(await slugs("frieren")).toContain("frieren");
    expect(await slugs("Beyond Journey")).toContain("frieren");
    expect(await slugs("naruto")).toContain("naruto");
  });

  it("короткий запрос работает как подстрока", async () => {
    await seedTitles();
    expect(await slugs("нару")).toEqual(["naruto"]);
  });

  it("точное совпадение выше опечатки", async () => {
    await createTitle({ slug: "exact", nameRu: "Дандадан", name: "Dandadan", synonyms: [] });
    await createTitle({ slug: "typo", nameRu: "Дандаадн", name: "Dandaadn", synonyms: [] });

    expect(await slugs("дандадан")).toEqual(["exact", "typo"]);
  });

  it("слишком короткий запрос не вытягивает весь каталог подстрокой", async () => {
    await seedTitles();

    // «а» есть почти в каждом названии: по подстроке сюда попал бы весь каталог со счётом 0.
    expect(await slugs("а")).toEqual([]);
    expect(await slugs("нар")).toEqual(["naruto"]);
  });

  it("выдача обрезается по лимиту и говорит об этом", async () => {
    for (let i = 0; i <= SEARCH_LIMIT; i += 1) {
      await createTitle({ slug: `naruto-${i}`, nameRu: `Наруто ${i}`, name: `Naruto ${i}` });
    }

    const { titles, truncated } = await searchTitles("наруто");
    expect(titles).toHaveLength(SEARCH_LIMIT);
    expect(truncated).toBe(true);
  });

  it("ничего похожего и пустой запрос — пустая выдача", async () => {
    await seedTitles();
    expect(await slugs("бухгалтерия")).toEqual([]);
    expect(await slugs("")).toEqual([]);
  });

  describe("приватность (docs/07)", () => {
    it("черновик и скрытый по жалобе тайтл не находятся даже по точному названию", async () => {
      await createTitle({ slug: "draft", nameRu: "Наруто", name: "Naruto", publishedAt: null });
      await createTitle({ slug: "hidden", nameRu: "Наруто", name: "Naruto", status: TitleStatus.HIDDEN });
      await createTitle({ slug: "public", nameRu: "Наруто", name: "Naruto" });

      expect(await slugs("наруто")).toEqual(["public"]);
    });

    it("скрытый тайтл не задирает относительный порог: иначе он выбивает живые совпадения", async () => {
      // Порог считается от лучшего счёта в выборке. Если непубличный тайтл попадёт в неё,
      // его точное совпадение поднимет планку и опечатка в публичном названии не пройдёт.
      await createTitle({ slug: "hidden", nameRu: "Наруто", name: "Naruto", status: TitleStatus.HIDDEN });
      await createTitle({ slug: "public", nameRu: "Наруот", name: "Naruot" });

      expect(await slugs("наруто")).toEqual(["public"]);
    });

    it("условия публичности в сыром SQL совпадают с publicTitleWhere()", async () => {
      // Условия продублированы в двух местах (SQL и Prisma-запрос). Тест ловит их расхождение:
      // например, если в хелпер добавят `publishedAt lte now`, а в SQL забудут.
      await createTitle({ slug: "draft", nameRu: "Наруто", name: "Naruto", publishedAt: null });
      await createTitle({ slug: "hidden", nameRu: "Наруто", name: "Naruto", status: TitleStatus.HIDDEN });
      await createTitle({
        slug: "future",
        nameRu: "Наруто",
        name: "Naruto",
        publishedAt: new Date(Date.now() + 86_400_000),
      });
      await createTitle({ slug: "public", nameRu: "Наруто", name: "Naruto" });

      const allowed = await prisma.title.findMany({ where: publicTitleWhere(), select: { slug: true } });
      expect(new Set(await slugs("наруто"))).toEqual(new Set(allowed.map((title) => title.slug)));
    });
  });
});
