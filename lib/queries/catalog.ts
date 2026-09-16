import type { CatalogParams, CatalogSort } from "@/lib/catalog/params";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { TitleKind } from "@/lib/generated/prisma/enums";
import { publicTitleWhere } from "@/lib/public-where";

export const CATALOG_PAGE_SIZE = 24;

export interface CatalogItem {
  id: string;
  slug: string;
  nameRu: string;
  posterUrl: string | null;
  kind: TitleKind;
  year: number | null;
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  pageCount: number;
}

export interface CatalogFilters {
  genres: string[];
  years: number[];
}

// id вторым ключом: без него при равных датах или названиях страницы пагинации теряют и дублируют тайтлы.
const ORDER_BY: Record<CatalogSort, Prisma.TitleOrderByWithRelationInput[]> = {
  new: [{ publishedAt: "desc" }, { id: "asc" }],
  year: [{ year: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  name: [{ nameRu: "asc" }, { id: "asc" }],
};

export async function getCatalog(params: CatalogParams): Promise<CatalogPage> {
  const { genre, year, status, kind, sort, page } = params;
  const where: Prisma.TitleWhereInput = {
    // AND, а не слияние объектов: фильтр статуса не должен перезаписать «не HIDDEN» из publicTitleWhere.
    AND: [publicTitleWhere(), { genres: genre ? { has: genre } : undefined, year, status, kind }],
  };

  const [total, items] = await prisma.$transaction([
    prisma.title.count({ where }),
    prisma.title.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: (page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
      select: { id: true, slug: true, nameRu: true, posterUrl: true, kind: true, year: true },
    }),
  ]);

  return { items, total, pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)) };
}

/** Значения для фильтров — только из публичных тайтлов: жанр скрытого тайтла не выдаёт его существование. */
export async function getCatalogFilters(): Promise<CatalogFilters> {
  const [titles, years] = await Promise.all([
    prisma.title.findMany({ where: publicTitleWhere(), select: { genres: true } }),
    prisma.title.groupBy({
      by: ["year"],
      where: { AND: [publicTitleWhere(), { year: { not: null } }] },
      orderBy: { year: "desc" },
    }),
  ]);

  const genres = [...new Set(titles.flatMap((title) => title.genres))].sort((a, b) => a.localeCompare(b, "ru"));
  return { genres, years: years.map((row) => row.year).filter((value): value is number => value !== null) };
}
