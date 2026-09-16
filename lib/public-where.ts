/**
 * Фильтры публичной выдачи. Любой запрос, который увидит зритель, идёт через них:
 * иначе он покажет черновики и тайтлы, скрытые по жалобе правообладателя.
 */
import { TitleStatus, type Prisma } from "./generated/prisma/client";

/** Тайтл опубликован и не скрыт. */
export function publicTitleWhere(): Prisma.TitleWhereInput {
  return { publishedAt: { not: null }, status: { not: TitleStatus.HIDDEN } };
}

/** Серия опубликована, и её тайтл публичен: HIDDEN у тайтла скрывает все его серии. */
export function publicEpisodeWhere(): Prisma.EpisodeWhereInput {
  return { publishedAt: { not: null }, title: publicTitleWhere() };
}
