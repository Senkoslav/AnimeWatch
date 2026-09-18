import { describe, expect, it } from "vitest";

import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";

import { withTracking } from "@/lib/canonical";

import {
  catalogHref,
  DEFAULT_SORT,
  hasFilters,
  parseCatalogParams,
  requestedCatalogHref,
  sanitizeCatalogParams,
} from "./params";

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

  it("управляющие символы в жанре — не жанр (Postgres не принимает \\0 в text)", () => {
    expect(parseCatalogParams({ genre: "\u0000" }).genre).toBeUndefined();
    expect(parseCatalogParams({ genre: "Драма\u0000" }).genre).toBeUndefined();
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

describe("withTracking", () => {
  it("метки кампаний переживают редирект, остальной мусор — нет", () => {
    expect(withTracking("/catalog", { utm_source: "telegram", foo: "bar", fbclid: "x" })).toBe(
      "/catalog?utm_source=telegram&fbclid=x",
    );
    expect(withTracking("/catalog?kind=tv", { utm_campaign: "ep7" })).toBe("/catalog?kind=tv&utm_campaign=ep7");
    expect(withTracking("/catalog", {})).toBe("/catalog");
  });
});

describe("sanitizeCatalogParams", () => {
  it("отбрасывает жанр и год, которых нет среди публичных тайтлов", () => {
    const options = { genres: ["Драма"], years: [2023] };
    expect(sanitizeCatalogParams({ genre: "Хоррор", year: 1999, sort: "name", page: 2 }, options)).toEqual({
      sort: "name",
      page: 2,
    });
    expect(sanitizeCatalogParams({ genre: "Драма", year: 2023, sort: "new", page: 1 }, options)).toEqual({
      genre: "Драма",
      year: 2023,
      sort: "new",
      page: 1,
    });
  });
});

describe("поиск в каталоге", () => {
  it("запрос из двух слов кодируется так же, как собирается пришедший адрес", () => {
    // Ровно та ловушка, о которой предупреждает docs/02: encodeURIComponent дал бы «%20» вместо «+»,
    // канонический адрес не совпал бы с пришедшим, и страница ушла бы в вечный редирект.
    const href = catalogHref({ q: "магическая битва", sort: DEFAULT_SORT, page: 1 });
    expect(href).toBe(
      "/catalog?q=%D0%BC%D0%B0%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F+%D0%B1%D0%B8%D1%82%D0%B2%D0%B0",
    );
    expect(requestedCatalogHref(Object.fromEntries(new URL(`https://x${href}`).searchParams))).toBe(href);
  });

  it("q стоит первым: порядок в адресе повторяет порядок полей формы", () => {
    expect(catalogHref({ q: "фрирен", genre: "Драма", sort: "name", page: 2 })).toBe(
      "/catalog?q=%D1%84%D1%80%D0%B8%D1%80%D0%B5%D0%BD&genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&sort=name&page=2",
    );
  });

  it("пустое и пробельное поле формы в адрес не попадает", () => {
    expect(parseCatalogParams({ q: "" }).q).toBeUndefined();
    expect(parseCatalogParams({ q: "   " }).q).toBeUndefined();
    expect(catalogHref(parseCatalogParams({ q: "  " }))).toBe("/catalog");
  });

  it("запрос считается отбором: «Сбросить» появляется и по нему одному", () => {
    expect(hasFilters({ q: "фрирен" })).toBe(true);
  });
});
