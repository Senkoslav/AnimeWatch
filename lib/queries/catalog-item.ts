import type { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";

/**
 * Карточка каталога — одна выборка на каталог и поиск. Отдельным модулем: каталог и поиск
 * импортируют друг друга, и значение отсюда, а не из них, не заводит цикл модулей в рантайме.
 */
export interface CatalogItem {
  id: string;
  slug: string;
  nameRu: string;
  posterUrl: string | null;
  kind: TitleKind;
  year: number | null;
  /** Оценка Shikimori. null — тайтл ещё никто не оценил, и значка на карточке не будет. */
  score: number | null;
  /** HIDDEN сюда не доходит: скрытый тайтл отсекается в publicTitleWhere ещё в запросе. */
  status: TitleStatus;
  totalEpisodes: number | null;
  /** Сколько серий опубликовано: «7 из 28» на постере (Catalog.dc.html). */
  published: number;
}

export const CATALOG_ITEM_SELECT = {
  id: true,
  slug: true,
  nameRu: true,
  posterUrl: true,
  kind: true,
  year: true,
  score: true,
  status: true,
  totalEpisodes: true,
  // Счётчик в том же запросе: на странице 24 карточки, отдельный запрос на каждую — это N+1.
  _count: { select: { episodes: { where: { publishedAt: { not: null } } } } },
} as const;

export function toCatalogItem({
  _count,
  ...title
}: Omit<CatalogItem, "published"> & { _count: { episodes: number } }): CatalogItem {
  return { ...title, published: _count.episodes };
}
