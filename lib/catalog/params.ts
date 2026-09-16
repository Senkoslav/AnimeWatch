/**
 * Состояние каталога в URL: /catalog?genre=Драма&year=2023&status=ongoing&kind=tv&sort=year&page=2.
 * URL — внешний вход: мусор и устаревшие значения не роняют страницу, а считаются «не задано».
 */
import type { Route } from "next";
import { z } from "zod";

import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";

export const CATALOG_SORTS = ["new", "year", "name"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

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

/** Варианты для <select>: значение в URL и соответствующее значение в базе. */
export const STATUS_OPTIONS = STATUS_PARAMS.map((param) => [param, STATUS_BY_PARAM[param]] as const);
export const KIND_OPTIONS = KIND_PARAMS.map((param) => [param, KIND_BY_PARAM[param]] as const);

export interface CatalogParams {
  genre?: string;
  year?: number;
  status?: PublicStatus;
  kind?: TitleKind;
  sort: CatalogSort;
  page: number;
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** Параметр повторён (?year=1&year=2) — берём первый. */
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const schema = z.object({
  // Управляющие символы (в том числе \0, который Postgres не принимает в text) — не жанр.
  genre: z
    .preprocess(
      first,
      z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^\P{Cc}+$/u)
        .optional(),
    )
    .catch(undefined),
  // Пустое поле формы (year=) приводится к 0 и не проходит min: получается «не задано».
  year: z.preprocess(first, z.coerce.number().int().min(1900).max(2100).optional()).catch(undefined),
  status: z.preprocess(first, z.enum(STATUS_PARAMS).optional()).catch(undefined),
  kind: z.preprocess(first, z.enum(KIND_PARAMS).optional()).catch(undefined),
  sort: z.preprocess(first, z.enum(CATALOG_SORTS)).catch("new"),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
});

export function parseCatalogParams(searchParams: SearchParams): CatalogParams {
  const { genre, year, status, kind, sort, page } = schema.parse(searchParams);
  return {
    genre,
    year,
    status: status && STATUS_BY_PARAM[status],
    kind: kind && KIND_BY_PARAM[kind],
    sort,
    page,
  };
}

/** Значение для URL и для <option value>: строчными, как в адресной строке. */
export function statusParam(status: PublicStatus): StatusParam {
  return status.toLowerCase() as StatusParam;
}

export function kindParam(kind: TitleKind): KindParam {
  return kind.toLowerCase() as KindParam;
}

/** Выбран ли хоть один фильтр (сортировка и страница не в счёт). */
export function hasFilters(params: Partial<CatalogParams>): boolean {
  return Boolean(params.genre || params.year || params.status || params.kind);
}

/** URL каталога в каноническом порядке, без пустых и значений по умолчанию. */
export function catalogHref(params: Partial<CatalogParams> = {}): Route {
  const query = new URLSearchParams();
  if (params.genre) query.set("genre", params.genre);
  if (params.year) query.set("year", String(params.year));
  if (params.status) query.set("status", statusParam(params.status));
  if (params.kind) query.set("kind", kindParam(params.kind));
  if (params.sort && params.sort !== "new") query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const search = query.toString();
  return search ? `/catalog?${search}` : "/catalog";
}

/**
 * Адрес запроса в том же виде, в каком пришёл: чтобы сравнить с catalogHref и понять, нужен ли редирект
 * на канонический URL (форма отправляет пустые поля, а в ссылках бывает мусор).
 */
export function requestedCatalogHref(searchParams: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }
  const search = query.toString();
  return search ? `/catalog?${search}` : "/catalog";
}

/** Метки кампаний не часть состояния каталога, но переживают редирект: иначе аналитика потеряет источник. */
const TRACKING_PARAM = /^(utm_[a-z]+|fbclid|gclid|yclid)$/;

/** Канонический адрес с сохранёнными метками кампаний из запроса. */
export function withTracking(href: Route, searchParams: SearchParams): Route {
  const tracking = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (!TRACKING_PARAM.test(key)) continue;
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      tracking.append(key, item);
    }
  }
  const extra = tracking.toString();
  if (!extra) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${extra}` as Route;
}

/**
 * Жанр и год, которых нет среди публичных тайтлов, отбрасываются: иначе любой текст из ?genre=
 * показывался бы выбранным фильтром, а число индексируемых пустых адресов было бы бесконечным.
 */
export function sanitizeCatalogParams(
  params: CatalogParams,
  options: { genres: readonly string[]; years: readonly number[] },
): CatalogParams {
  return {
    ...params,
    genre: params.genre && options.genres.includes(params.genre) ? params.genre : undefined,
    year: params.year && options.years.includes(params.year) ? params.year : undefined,
  };
}
