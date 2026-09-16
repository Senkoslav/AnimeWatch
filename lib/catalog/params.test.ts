import { describe, expect, it } from "vitest";

import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";

import { catalogHref, hasFilters, parseCatalogParams, requestedCatalogHref } from "./params";

describe("parseCatalogParams", () => {
  it("пустой URL — всё по умолчанию", () => {
    expect(parseCatalogParams({})).toEqual({ sort: "new", page: 1 });
  });

  it("разбирает все фильтры", () => {
    expect(
      parseCatalogParams({ genre: "Драма", year: "2023", status: "ongoing", kind: "tv", sort: "name", page: "3" }),
    ).toEqual({ genre: "Драма", year: 2023, status: TitleStatus.ONGOING, kind: TitleKind.TV, sort: "name", page: 3 });
  });

  it("мусор и пустые поля формы считаются «не задано», а не ошибкой", () => {
    expect(
      parseCatalogParams({ genre: "  ", year: "abc", status: "", kind: "anime", sort: "rating", page: "-1" }),
    ).toEqual({ sort: "new", page: 1 });
    expect(parseCatalogParams({ year: "", page: "2.5" })).toEqual({ sort: "new", page: 1 });
  });

  it("скрытый статус через URL не выбрать", () => {
    expect(parseCatalogParams({ status: "hidden" }).status).toBeUndefined();
    expect(parseCatalogParams({ status: "HIDDEN" }).status).toBeUndefined();
  });

  it("повтор параметра — берётся первый", () => {
    expect(parseCatalogParams({ year: ["2020", "2021"], genre: ["Драма", "Экшен"] })).toMatchObject({
      year: 2020,
      genre: "Драма",
    });
  });

  it("обрезает пробелы вокруг жанра", () => {
    expect(parseCatalogParams({ genre: " Драма " }).genre).toBe("Драма");
  });
});

describe("catalogHref", () => {
  it("без фильтров и со значениями по умолчанию — чистый /catalog", () => {
    expect(catalogHref()).toBe("/catalog");
    expect(catalogHref({ sort: "new", page: 1 })).toBe("/catalog");
  });

  it("канонический порядок и строчные значения enum", () => {
    expect(
      catalogHref({ page: 2, kind: TitleKind.MOVIE, genre: "Драма", sort: "year", status: TitleStatus.COMPLETED }),
    ).toBe("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&status=completed&kind=movie&sort=year&page=2");
  });

  it("разбор читает ровно то, что собрала сборка", () => {
    const params = {
      genre: "Сверхъестественное",
      year: 2016,
      status: TitleStatus.ANNOUNCED,
      kind: TitleKind.OVA,
      sort: "name",
      page: 4,
    } as const;
    const url = new URL(catalogHref(params), "http://localhost");
    expect(parseCatalogParams(Object.fromEntries(url.searchParams))).toEqual(params);
  });
});

describe("hasFilters", () => {
  it("сортировка и страница фильтрами не считаются", () => {
    expect(hasFilters({ sort: "name", page: 3 })).toBe(false);
    expect(hasFilters({ year: 2023 })).toBe(true);
  });
});

describe("requestedCatalogHref", () => {
  it("канонический адрес совпадает с собой, а отправка формы с пустыми полями — нет", () => {
    const canonical = catalogHref({ genre: "Драма", kind: TitleKind.TV, sort: "name" });
    const url = new URL(canonical, "http://localhost");
    expect(requestedCatalogHref(Object.fromEntries(url.searchParams))).toBe(canonical);

    const formSubmit = { genre: "Драма", year: "", status: "", kind: "tv", sort: "name" };
    expect(requestedCatalogHref(formSubmit)).not.toBe(catalogHref(parseCatalogParams(formSubmit)));
    expect(catalogHref(parseCatalogParams(formSubmit))).toBe(canonical);
  });

  it("повторённые параметры сохраняются, чтобы их тоже увело на канонический адрес", () => {
    expect(requestedCatalogHref({ year: ["2020", "2021"] })).toBe("/catalog?year=2020&year=2021");
  });
});
