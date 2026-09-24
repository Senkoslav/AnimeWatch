/**
 * Данные для рекомендаций: публичный каталог со связями, отметки пользователя и его «не интересно».
 * Считает lib/recommendations/score.ts, здесь только выборки и сборка карточек.
 *
 * Каталог целиком — сотни тайтлов, миллисекунды. На десятках тысяч это место для кеша или отбора
 * кандидатов в SQL (docs/06, открытые вопросы).
 */
import { prisma } from "@/lib/db";
import { publicTitleWhere } from "@/lib/public-where";
import { type Reason, recommend } from "@/lib/recommendations/score";

import { CATALOG_ITEM_SELECT, type CatalogItem, toCatalogItem } from "./catalog-item";

export interface RecommendedTitle {
  title: CatalogItem;
  reason: Reason;
}

export interface Recommendations {
  items: RecommendedTitle[];
  /** false — холодный старт: отметок мало, это популярное с высокой оценкой, а не «ваше». */
  personal: boolean;
}

/** Советы для пользователя; null — аноним, для него только холодный старт. */
export async function getRecommendations(userId: string | null, limit: number): Promise<Recommendations> {
  const [catalog, marks, dismissals] = await Promise.all([
    prisma.title.findMany({
      where: publicTitleWhere(),
      select: {
        id: true,
        shikimoriId: true,
        nameRu: true,
        genres: true,
        score: true,
        popularityRank: true,
        relations: { select: { targetShikimoriId: true, kind: true, rank: true } },
      },
    }),
    userId
      ? prisma.bookmark.findMany({ where: { userId }, select: { titleId: true, state: true, rating: true } })
      : Promise.resolve([]),
    userId
      ? prisma.recommendationDismissal.findMany({ where: { userId }, select: { titleId: true } })
      : Promise.resolve([]),
  ]);

  const { items, personal } = recommend({
    catalog,
    marks,
    dismissed: dismissals.map((dismissal) => dismissal.titleId),
    limit,
  });
  if (items.length === 0) return { items: [], personal };

  const cards = await prisma.title.findMany({
    where: { AND: [publicTitleWhere(), { id: { in: items.map((item) => item.titleId) } }] },
    select: CATALOG_ITEM_SELECT,
  });
  const byId = new Map(cards.map((card) => [card.id, toCatalogItem(card)]));
  return {
    personal,
    items: items.flatMap(({ titleId, reason }) => {
      const title = byId.get(titleId);
      return title ? [{ title, reason }] : [];
    }),
  };
}

/** «Не интересно»: только публичный тайтл, повтор — не ошибка. false — тайтла нет или он скрыт. */
export async function dismissTitle(userId: string, titleId: string): Promise<boolean> {
  const visible = await prisma.title.count({ where: { AND: [{ id: titleId }, publicTitleWhere()] } });
  if (visible === 0) return false;
  await prisma.recommendationDismissal.upsert({
    where: { userId_titleId: { userId, titleId } },
    create: { userId, titleId },
    update: {},
  });
  return true;
}

/** «Вернуть» скрытый совет. Своё скрытие и только его: чужое этот запрос не видит. */
export async function restoreTitle(userId: string, titleId: string): Promise<void> {
  await prisma.recommendationDismissal.deleteMany({ where: { userId, titleId } });
}
