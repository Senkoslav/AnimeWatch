/**
 * Состояние каталога в URL:
 * /catalog?q=фрирен&genre=Драма&genre=Фэнтези&year_from=2018&year_to=2024&status=ongoing&kind=tv&sort=year&page=2
 *
 * URL — внешний вход: мусор и устаревшие значения не роняют страницу, а считаются «не задано».
 *
 * Жанр и тип повторяемые: отбор по двум жанрам сразу — это «или», а не «и». Год задаётся
 * диапазоном двумя границами, каждая — сама по себе.
 */
import type { Route } from "next";
import { z } from "zod";

import { requestedHref, type SearchParams } from "@/lib/canonical";
import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";
// Обратная сторона пары — только типовая (lib/labels.ts берёт отсюда типы), она стирается
// при сборке, так что рантайм-цикла между модулями нет.
import { KIND_LABELS, STATUS_LABELS } from "@/lib/labels";
import { searchQuerySchema } from "@/lib/search/query";

export const CATALOG_SORTS = ["new", "popular", "score", "year", "name"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
/** Порядок по умолчанию: он же отсутствует в каноническом адресе. */
export const DEFAULT_SORT: CatalogSort = "new";

/** HIDDEN в фильтре нет: скрытый по жалобе тайтл не существует для зрителя. */
const STATUS_BY_PARAM = {
  ongoing: TitleStatus.ONGOING,
  completed: TitleStatus.COMPLETED,
  announced: TitleStatus.ANNOUNCED,
} as const;
export type PublicStatus = (typeof STATUS_BY_PARAM)[keyof typeof STATUS_BY_PARAM];

const KIND_BY_PARAM = {
  tv: TitleKind.TV,
  movie: TitleKind.MOVIE,
  ova: TitleKind.OVA,
  ona: TitleKind.ONA,
  special: TitleKind.SPECIAL,
} as const;

type StatusParam = keyof typeof STATUS_BY_PARAM;
type KindParam = keyof typeof KIND_BY_PARAM;

const STATUS_PARAMS = Object.keys(STATUS_BY_PARAM) as StatusParam[];
const KIND_PARAMS = Object.keys(KIND_BY_PARAM) as KindParam[];

/** Варианты для переключателя и чипов: значение в URL и соответствующее значение в базе. */
export const STATUS_OPTIONS = STATUS_PARAMS.map((param) => [param, STATUS_BY_PARAM[param]] as const);
export const KIND_OPTIONS = KIND_PARAMS.map((param) => [param, KIND_BY_PARAM[param]] as const);

/** Порядок жанров в адресе и в панели один: тот, в котором их отдаёт getCatalogFilters(). */
export const compareGenres = (a: string, b: string) => a.localeCompare(b, "ru");

export interface CatalogParams {
  /** Поиск по названию. Пустая строка не доходит: её нормализация сводит к undefined. */
  q?: string;
  /** Несколько жанров — «или»: «Драма или Комедия», иначе отбор по двум жанрам почти всегда пуст. */
  genres: string[];
  yearFrom?: number;
  yearTo?: number;
  /** Статус один: тайтл не бывает одновременно выходящим и завершённым. */
  status?: PublicStatus;
  kinds: TitleKind[];
  sort: CatalogSort;
  page: number;
}

/** Параметр повторён (?page=1&page=2) — берём первый. */
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

/** Год: пустое поле формы (year_from=) приводится к 0 и не проходит min — получается «не задано». */
const yearBound = z.preprocess(first, z.coerce.number().int().min(1900).max(2100).optional()).catch(undefined);

const schema = z.object({
  // Тот же разбор, что на /search: повторы, массивы и мусор сводятся к одной строке.
  // Пустая — это «не задано», иначе `?q=` остался бы в каноническом адресе.
  q: searchQuerySchema.transform((query) => query || undefined),
  year_from: yearBound,
  year_to: yearBound,
  status: z.preprocess(first, z.enum(STATUS_PARAMS).optional()).catch(undefined),
  sort: z.preprocess(first, z.enum(CATALOG_SORTS)).catch(DEFAULT_SORT),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
});

/** Управляющие символы (в том числе \0, который Postgres не принимает в text) — не жанр. */
const genreValue = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^\P{Cc}+$/u);

/**
 * Повторяемый параметр: одиночное значение, массив и отсутствие сводятся к списку годных значений.
 * Негодные выбрасываются поштучно — один мусорный ?genre= не должен отменять остальные, — а дубли
 * схлопываются: ?genre=Драма&genre=Драма это один жанр.
 */
function parseMany<T>(value: string | string[] | undefined, item: z.ZodType<T>): T[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const parsed = values.map((entry) => item.safeParse(entry)).filter((result) => result.success);
  return [...new Set(parsed.map((result) => result.data))];
}

export function parseCatalogParams(searchParams: SearchParams): CatalogParams {
  const parsed = schema.parse(searchParams);

  // Границы наоборот («от 2024 до 2018») — это опечатка в ссылке, а не пустая выдача: меняем местами.
  const swap = parsed.year_from && parsed.year_to && parsed.year_from > parsed.year_to;
  const yearFrom = swap ? parsed.year_to : parsed.year_from;
  const yearTo = swap ? parsed.year_from : parsed.year_to;

  return {
    q: parsed.q,
    genres: parseMany(searchParams.genre, genreValue).sort(compareGenres),
    yearFrom,
    yearTo,
    status: parsed.status && STATUS_BY_PARAM[parsed.status],
    kinds: parseMany(searchParams.kind, z.enum(KIND_PARAMS)).map((kind) => KIND_BY_PARAM[kind]),
    sort: parsed.sort,
    page: parsed.page,
  };
}

/** Значение для URL и для value чекбокса: строчными, как в адресной строке. */
export function statusParam(status: PublicStatus): StatusParam {
  return status.toLowerCase() as StatusParam;
}

export function kindParam(kind: TitleKind): KindParam {
  return kind.toLowerCase() as KindParam;
}

/** Задан ли хоть один отбор (сортировка и страница не в счёт). */
export function hasFilters(params: Partial<CatalogParams>): boolean {
  return Boolean(
    params.q || params.genres?.length || params.yearFrom || params.yearTo || params.status || params.kinds?.length,
  );
}

/** URL каталога в каноническом порядке, без пустых и значений по умолчанию. */
export function catalogHref(params: Partial<CatalogParams> = {}): Route {
  const query = new URLSearchParams();
  // Порядок здесь обязан совпадать с порядком полей в форме, а порядок повторяемых значений —
  // с порядком их полей в разметке: пришедший адрес собирается как есть (requestedCatalogHref),
  // и любая перестановка увела бы страницу в вечный редирект.
  // Кодирование — только URLSearchParams: encodeURIComponent пишет пробел как «%20» против «+»,
  // и запрос из двух слов зациклился бы (та же ловушка, что в searchHref).
  if (params.q) query.set("q", params.q);
  for (const genre of [...(params.genres ?? [])].sort(compareGenres)) query.append("genre", genre);
  if (params.yearFrom) query.set("year_from", String(params.yearFrom));
  if (params.yearTo) query.set("year_to", String(params.yearTo));
  if (params.status) query.set("status", statusParam(params.status));
  for (const [param, kind] of KIND_OPTIONS) {
    if (params.kinds?.includes(kind)) query.append("kind", param);
  }
  if (params.sort && params.sort !== DEFAULT_SORT) query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const search = query.toString();
  return search ? `/catalog?${search}` : "/catalog";
}

/** Адрес запроса каталога в том же виде, в каком пришёл: с ним сравнивается catalogHref. */
export function requestedCatalogHref(searchParams: SearchParams): string {
  return requestedHref("/catalog", searchParams);
}

export interface CatalogOptions {
  genres: readonly string[];
  years: readonly number[];
}

/**
 * Жанр и год, которых нет среди публичных тайтлов, отбрасываются: иначе любой текст из ?genre=
 * показывался бы выбранным фильтром, а число индексируемых пустых адресов было бы бесконечным.
 */
export function sanitizeCatalogParams(params: CatalogParams, options: CatalogOptions): CatalogParams {
  const known = (year: number | undefined) => (year && options.years.includes(year) ? year : undefined);
  return {
    ...params,
    genres: params.genres.filter((genre) => options.genres.includes(genre)),
    yearFrom: known(params.yearFrom),
    yearTo: known(params.yearTo),
  };
}

/**
 * Отборы, которые действуют прямо сейчас, — метками над выдачей. У каждой метки свой адрес
 * «без себя»: снять один отбор должно быть так же просто, как поставить.
 */
export interface ActiveFilter {
  key: string;
  label: string;
  href: Route;
}

export function activeFilters(params: CatalogParams): ActiveFilter[] {
  const base = { ...params, page: 1 };
  const filters: ActiveFilter[] = [];

  if (params.q) filters.push({ key: "q", label: `«${params.q}»`, href: catalogHref({ ...base, q: undefined }) });

  for (const genre of params.genres) {
    filters.push({
      key: `genre:${genre}`,
      label: genre,
      href: catalogHref({ ...base, genres: params.genres.filter((item) => item !== genre) }),
    });
  }

  if (params.yearFrom || params.yearTo) {
    filters.push({
      key: "year",
      label: yearRangeLabel(params.yearFrom, params.yearTo),
      href: catalogHref({ ...base, yearFrom: undefined, yearTo: undefined }),
    });
  }

  if (params.status) {
    filters.push({
      key: "status",
      label: STATUS_LABELS[params.status],
      href: catalogHref({ ...base, status: undefined }),
    });
  }

  for (const kind of params.kinds) {
    filters.push({
      key: `kind:${kind}`,
      label: KIND_LABELS[kind],
      href: catalogHref({ ...base, kinds: params.kinds.filter((item) => item !== kind) }),
    });
  }

  return filters;
}

/** «2018—2024», «с 2018», «до 2024»: одна граница — это тоже диапазон, и он должен читаться. */
export function yearRangeLabel(from: number | undefined, to: number | undefined): string {
  if (from && to) return from === to ? String(from) : `${from}—${to}`;
  if (from) return `с ${from}`;
  return `до ${to}`;
}

/**
 * Пресеты — готовые наборы параметров ссылками, а не новый механизм. «Топ сезона» с макета здесь
 * нет: сезон у нас строка от Shikimori, и честного запроса «текущий сезон» из неё не собрать
 * (docs/06, фаза C).
 */
export interface CatalogPreset {
  name: string;
  params: Partial<CatalogParams>;
}

export const CATALOG_PRESETS: CatalogPreset[] = [
  { name: "Онгоинги", params: { status: TitleStatus.ONGOING } },
  { name: "Популярное", params: { sort: "popular" } },
  { name: "По рейтингу", params: { sort: "score" } },
  { name: "Фильмы", params: { kinds: [TitleKind.MOVIE] } },
];

/**
 * Пресет отмечен выбранным, только когда открыт ровно он: «Онгоинги плюс жанр» — это уже не
 * пресет, и подсвеченный чип соврал бы про то, что показано.
 */
export function presetHref(preset: CatalogPreset): Route {
  return catalogHref({ genres: [], kinds: [], sort: DEFAULT_SORT, page: 1, ...preset.params });
}

export function isPresetActive(params: CatalogParams, preset: CatalogPreset): boolean {
  return catalogHref({ ...params, page: 1 }) === presetHref(preset);
}
