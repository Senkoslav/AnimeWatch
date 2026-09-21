import { describe, expect, it } from "vitest";

import { withTracking } from "@/lib/canonical";
import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";

import {
  activeFilters,
  type CatalogParams,
  CATALOG_PRESETS,
  catalogHref,
  DEFAULT_SORT,
  hasFilters,
  isPresetActive,
  parseCatalogParams,
  presetHref,
  requestedCatalogHref,
  sanitizeCatalogParams,
  yearRangeLabel,
} from "./params";

/** Пустой отбор: с ним сравнивается всё остальное. */
const EMPTY = { genres: [], kinds: [], sort: DEFAULT_SORT, page: 1 };

describe("parseCatalogParams", () => {
  it("пустой URL — всё по умолчанию", () => {
    expect(parseCatalogParams({})).toEqual(EMPTY);
  });

  it("разбирает все фильтры", () => {
    expect(
      parseCatalogParams({
        genre: "Драма",
        year_from: "2018",
        year_to: "2023",
        status: "ongoing",
        kind: "tv",
        sort: "name",
        page: "3",
      }),
    ).toEqual({
      genres: ["Драма"],
      yearFrom: 2018,
      yearTo: 2023,
      status: TitleStatus.ONGOING,
      kinds: [TitleKind.TV],
      sort: "name",
      page: 3,
    });
  });

  it("мусор и пустые поля формы считаются «не задано», а не ошибкой", () => {
    expect(
      parseCatalogParams({ genre: "  ", year_from: "abc", status: "", kind: "anime", sort: "rating", page: "-1" }),
    ).toEqual(EMPTY);
    expect(parseCatalogParams({ year_to: "", page: "2.5" })).toEqual(EMPTY);
  });

  it("скрытый статус через URL не выбрать", () => {
    expect(parseCatalogParams({ status: "hidden" }).status).toBeUndefined();
    expect(parseCatalogParams({ status: "HIDDEN" }).status).toBeUndefined();
  });

  it("жанр и тип повторяемые: берутся все годные значения, а не первое", () => {
    expect(parseCatalogParams({ genre: ["Экшен", "Драма"], kind: ["movie", "tv"] })).toMatchObject({
      // Жанры приводятся к тому же порядку, в котором их отдаёт каталог и отправляет форма.
      genres: ["Драма", "Экшен"],
      kinds: [TitleKind.MOVIE, TitleKind.TV],
    });
  });

  it("один мусорный повтор не отменяет остальные, дубли схлопываются", () => {
    expect(parseCatalogParams({ genre: ["Драма", "\u0000", "Драма"] }).genres).toEqual(["Драма"]);
    expect(parseCatalogParams({ kind: ["tv", "манга", "tv"] }).kinds).toEqual([TitleKind.TV]);
  });

  it("границы года наоборот меняются местами, а не дают пустую выдачу", () => {
    expect(parseCatalogParams({ year_from: "2024", year_to: "2018" })).toMatchObject({
      yearFrom: 2018,
      yearTo: 2024,
    });
  });

  it("одна граница — это тоже диапазон", () => {
    expect(parseCatalogParams({ year_from: "2020" })).toMatchObject({ yearFrom: 2020, yearTo: undefined });
    expect(parseCatalogParams({ year_to: "2020" })).toMatchObject({ yearFrom: undefined, yearTo: 2020 });
  });

  it("управляющие символы в жанре — не жанр (Postgres не принимает \\0 в text)", () => {
    expect(parseCatalogParams({ genre: "\u0000" }).genres).toEqual([]);
    expect(parseCatalogParams({ genre: "Драма\u0000" }).genres).toEqual([]);
  });

  it("обрезает пробелы вокруг жанра", () => {
    expect(parseCatalogParams({ genre: " Драма " }).genres).toEqual(["Драма"]);
  });
});

describe("catalogHref", () => {
  it("без фильтров и со значениями по умолчанию — чистый /catalog", () => {
    expect(catalogHref()).toBe("/catalog");
    expect(catalogHref(EMPTY)).toBe("/catalog");
  });

  it("канонический порядок и строчные значения enum", () => {
    expect(
      catalogHref({
        page: 2,
        kinds: [TitleKind.MOVIE],
        genres: ["Драма"],
        sort: "year",
        status: TitleStatus.COMPLETED,
      }),
    ).toBe("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&status=completed&kind=movie&sort=year&page=2");
  });

  it("повторяемые значения идут в том же порядке, в каком их отправляет форма", () => {
    // Жанры по алфавиту, типы — в порядке полей в панели. Иначе пришедший адрес не совпал бы с
    // каноническим, и каждая отправка формы уводила бы страницу в лишний редирект.
    expect(catalogHref({ genres: ["Экшен", "Драма"], kinds: [TitleKind.OVA, TitleKind.TV] })).toBe(
      "/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&genre=%D0%AD%D0%BA%D1%88%D0%B5%D0%BD&kind=tv&kind=ova",
    );
  });

  it("разбор читает ровно то, что собрала сборка", () => {
    const params = {
      genres: ["Драма", "Сверхъестественное"],
      yearFrom: 2016,
      yearTo: 2020,
      status: TitleStatus.ANNOUNCED,
      kinds: [TitleKind.OVA],
      sort: "name",
      page: 4,
    } satisfies CatalogParams;
    const href = catalogHref(params);
    const url = new URL(href, "http://localhost");
    // Object.fromEntries схлопнул бы повторы, а они здесь и проверяются.
    const query: Record<string, string[]> = {};
    for (const [key, value] of url.searchParams) (query[key] ??= []).push(value);
    expect(parseCatalogParams(query)).toEqual(params);
    expect(requestedCatalogHref(query)).toBe(href);
  });
});

describe("hasFilters", () => {
  it("сортировка и страница фильтрами не считаются", () => {
    expect(hasFilters({ sort: "name", page: 3 })).toBe(false);
    expect(hasFilters({ yearFrom: 2023 })).toBe(true);
    expect(hasFilters({ genres: [] })).toBe(false);
    expect(hasFilters({ genres: ["Драма"] })).toBe(true);
  });
});

describe("requestedCatalogHref", () => {
  it("канонический адрес совпадает с собой, а отправка формы с пустыми полями — нет", () => {
    const canonical = catalogHref({ genres: ["Драма"], kinds: [TitleKind.TV], sort: "name" });
    const url = new URL(canonical, "http://localhost");
    expect(requestedCatalogHref(Object.fromEntries(url.searchParams))).toBe(canonical);

    const formSubmit = { genre: "Драма", year_from: "", year_to: "", status: "", kind: "tv", sort: "name" };
    expect(requestedCatalogHref(formSubmit)).not.toBe(catalogHref(parseCatalogParams(formSubmit)));
    expect(catalogHref(parseCatalogParams(formSubmit))).toBe(canonical);
  });

  it("повторённые параметры сохраняются, чтобы их тоже увело на канонический адрес", () => {
    expect(requestedCatalogHref({ year_from: ["2020", "2021"] })).toBe("/catalog?year_from=2020&year_from=2021");
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
  const options = { genres: ["Драма"], years: [2023, 2018] };

  it("отбрасывает жанр и год, которых нет среди публичных тайтлов", () => {
    expect(sanitizeCatalogParams({ ...EMPTY, genres: ["Хоррор"], yearFrom: 1999, page: 2 }, options)).toEqual({
      ...EMPTY,
      page: 2,
    });
  });

  it("оставляет годное и выбрасывает негодное из одного набора", () => {
    expect(
      sanitizeCatalogParams({ ...EMPTY, genres: ["Драма", "Хоррор"], yearFrom: 2018, yearTo: 2023 }, options),
    ).toEqual({ ...EMPTY, genres: ["Драма"], yearFrom: 2018, yearTo: 2023 });
  });
});

describe("activeFilters", () => {
  it("у каждой метки адрес без неё одной", () => {
    const params = {
      ...EMPTY,
      genres: ["Драма", "Экшен"],
      status: TitleStatus.ONGOING,
      kinds: [TitleKind.TV],
    };
    const filters = activeFilters(params);

    expect(filters.map((filter) => filter.label)).toEqual(["Драма", "Экшен", "Выходит", "ТВ-сериал"]);
    // Снятие «Драма» оставляет «Экшен» и всё остальное на месте.
    expect(filters.at(0)?.href).toBe(catalogHref({ ...params, genres: ["Экшен"] }));
    expect(filters.at(2)?.href).toBe(catalogHref({ ...params, status: undefined }));
  });

  it("снятие метки всегда возвращает на первую страницу: на второй выдачи может уже не быть", () => {
    const filters = activeFilters({ ...EMPTY, page: 5, status: TitleStatus.ONGOING });
    expect(filters.at(0)?.href).toBe("/catalog");
  });

  it("диапазон года — одна метка, а не две", () => {
    expect(activeFilters({ ...EMPTY, yearFrom: 2018, yearTo: 2023 })).toHaveLength(1);
  });
});

describe("yearRangeLabel", () => {
  it("читается при любой из границ", () => {
    expect(yearRangeLabel(2018, 2023)).toBe("2018—2023");
    expect(yearRangeLabel(2020, 2020)).toBe("2020");
    expect(yearRangeLabel(2018, undefined)).toBe("с 2018");
    expect(yearRangeLabel(undefined, 2023)).toBe("до 2023");
  });
});

describe("пресеты", () => {
  it("пресет — это адрес каталога и ничего больше", () => {
    expect(CATALOG_PRESETS.map(presetHref)).toEqual([
      "/catalog?status=ongoing",
      "/catalog?sort=popular",
      "/catalog?sort=score",
      "/catalog?kind=movie",
    ]);
  });

  it("отмечен выбранным, только когда открыт ровно он", () => {
    const ongoing = CATALOG_PRESETS.find((preset) => preset.name === "Онгоинги");
    if (!ongoing) throw new Error("пресет «Онгоинги» пропал из набора");
    expect(isPresetActive(parseCatalogParams({ status: "ongoing" }), ongoing)).toBe(true);
    // «Онгоинги плюс жанр» — это уже не пресет, и подсвеченный чип соврал бы про то, что показано.
    expect(isPresetActive(parseCatalogParams({ status: "ongoing", genre: "Драма" }), ongoing)).toBe(false);
    expect(isPresetActive(parseCatalogParams({}), ongoing)).toBe(false);
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
    expect(catalogHref({ q: "фрирен", genres: ["Драма"], sort: "name", page: 2 })).toBe(
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
