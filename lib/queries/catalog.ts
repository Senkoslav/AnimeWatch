import type { CatalogParams, CatalogSort } from "@/lib/catalog/params";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { publicTitleWhere } from "@/lib/public-where";

// Карточка — из своего модуля: поиск берёт её оттуда же, и цикла каталог ↔ поиск в рантайме нет.
import { CATALOG_ITEM_SELECT, type CatalogItem, toCatalogItem } from "./catalog-item";
import { CATALOG_MATCH_LIMIT, rankTitleIds } from "./search";

export const CATALOG_PAGE_SIZE = 24;

export type { CatalogItem } from "./catalog-item";

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  pageCount: number;
  /** Совпадений по `q` было больше предела отбора: счётчик считает внутри отобранных, а не по каталогу. */
  truncated: boolean;
}

export interface CatalogFilters {
  genres: string[];
  years: number[];
}

// id вторым ключом: без него при равных датах или названиях страницы пагинации теряют и дублируют тайтлы.
const ORDER_BY: Record<CatalogSort, Prisma.TitleOrderByWithRelationInput[]> = {
  new: [{ publishedAt: "desc" }, { id: "asc" }],
  // Ранг известен не всем тайтлам: он есть только у пришедших пакетным импортом по популярности.
  // Неизвестный уезжает в конец, иначе тайтл без ранга возглавил бы список самых популярных.
  popular: [{ popularityRank: { sort: "asc", nulls: "last" } }, { id: "asc" }],
  score: [{ score: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  year: [{ year: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  name: [{ nameRu: "asc" }, { id: "asc" }],
};

export async function getCatalog(params: CatalogParams): Promise<CatalogPage> {
  const { q, genres, yearFrom, yearTo, status, kinds, sort, page } = params;

  // Поиск сужает набор, а не заменяет выдачу: жанр, год, сортировка и страницы работают поверх него
  // ровно как раньше. Тем же запросом, что и /search: два разных дали бы разное на одно слово.
  const matched = q ? await rankTitleIds(q, CATALOG_MATCH_LIMIT) : null;
  // Счёт идёт внутри отобранных совпадений, поэтому при обрезке «Найдено N» — это N среди первых
  // CATALOG_MATCH_LIMIT, а не во всём каталоге. Страница обязана сказать об этом, а не молча соврать.
  const truncated = matched?.truncated ?? false;
  if (matched && matched.ids.length === 0) return { items: [], total: 0, pageCount: 1, truncated };

  const where: Prisma.TitleWhereInput = {
    // AND, а не слияние объектов: фильтр статуса не должен перезаписать «не HIDDEN» из publicTitleWhere.
    AND: [
      publicTitleWhere(),
      {
        // Несколько жанров — «или» (hasSome): у тайтла редко стоят сразу два выбранных, и «и»
        // превращало бы второй жанр в кнопку «очистить выдачу». То же у типов.
        genres: genres.length > 0 ? { hasSome: genres } : undefined,
        // Год диапазоном. Границы независимы: задана одна — вторая не ограничивает.
        // Тайтл без года под заданный диапазон не попадает, и это верно: год неизвестен.
        year: yearFrom || yearTo ? { gte: yearFrom, lte: yearTo } : undefined,
        status,
        kind: kinds.length > 0 ? { in: kinds } : undefined,
      },
      ...(matched ? [{ id: { in: matched.ids } }] : []),
    ],
  };

  // Без транзакции: точное совпадение счётчика и страницы не нужно, а транзакция держит соединение из пула.
  const [total, items] = await Promise.all([
    prisma.title.count({ where }),
    prisma.title.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: (page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
      select: CATALOG_ITEM_SELECT,
    }),
  ]);

  return {
    items: items.map(toCatalogItem),
    total,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
    truncated,
  };
}

/** Значения для фильтров — только из публичных тайтлов: жанр скрытого тайтла не выдаёт его существование. */
export async function getCatalogFilters(): Promise<CatalogFilters> {
  // Один запрос на оба списка: тайтлов сотни, свёртка в JS дешевле второго похода в базу.
  const titles = await prisma.title.findMany({ where: publicTitleWhere(), select: { genres: true, year: true } });

  const genres = [...new Set(titles.flatMap((title) => title.genres))].sort((a, b) => a.localeCompare(b, "ru"));
  const years = [...new Set(titles.map((title) => title.year).filter((year): year is number => year !== null))];
  return { genres, years: years.sort((a, b) => b - a) };
}
