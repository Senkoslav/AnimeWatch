/**
 * Отметки и оценки (docs/03, Bookmark). Функции от userId: кто пользователь, решает server action
 * (lib/bookmarks/actions.ts), а здесь только данные — так они тестируются на базе без кук.
 */
import { prisma } from "@/lib/db";
import { WatchState } from "@/lib/generated/prisma/enums";
import { publicTitleWhere } from "@/lib/public-where";

export interface BookmarkView {
  state: WatchState;
  rating: number | null;
}

const VIEW_SELECT = { state: true, rating: true } as const;

/** Отметить можно только публичный тайтл: черновик и скрытый по жалобе для зрителя не существуют. */
async function isPublicTitle(titleId: string): Promise<boolean> {
  return (await prisma.title.count({ where: { AND: [{ id: titleId }, publicTitleWhere()] } })) > 0;
}

export async function getBookmark(userId: string, titleId: string): Promise<BookmarkView | null> {
  return prisma.bookmark.findUnique({ where: { userId_titleId: { userId, titleId } }, select: VIEW_SELECT });
}

/** Список. null — тайтла нет или он не публичный. Оценка при смене списка остаётся. */
export async function setListState(userId: string, titleId: string, state: WatchState): Promise<BookmarkView | null> {
  if (!(await isPublicTitle(titleId))) return null;
  return prisma.bookmark.upsert({
    where: { userId_titleId: { userId, titleId } },
    create: { userId, titleId, state },
    update: { state },
    select: VIEW_SELECT,
  });
}

/**
 * Оценка 1–10 или null — снять. Тайтл вне списков оценкой кладётся в «Просмотрено» (решение
 * владельца 2026-09-23, как у Shikimori). Снятие оценки строку не создаёт.
 */
export async function setRating(userId: string, titleId: string, rating: number | null): Promise<BookmarkView | null> {
  if (!(await isPublicTitle(titleId))) return null;
  if (rating === null) {
    const existing = await getBookmark(userId, titleId);
    if (!existing) return null;
    return prisma.bookmark.update({
      where: { userId_titleId: { userId, titleId } },
      data: { rating: null },
      select: VIEW_SELECT,
    });
  }
  return prisma.bookmark.upsert({
    where: { userId_titleId: { userId, titleId } },
    create: { userId, titleId, state: WatchState.COMPLETED, rating },
    update: { rating },
    select: VIEW_SELECT,
  });
}

/** Убрать из списков — вместе с оценкой: отдельно от строки она не живёт. */
export async function removeBookmark(userId: string, titleId: string): Promise<void> {
  await prisma.bookmark.deleteMany({ where: { userId, titleId } });
}

/** Отметки для страницы каталога одним запросом: 24 карточки — не 24 запроса. */
export async function getBookmarkStates(userId: string, titleIds: string[]): Promise<Map<string, WatchState>> {
  if (titleIds.length === 0) return new Map();
  const rows = await prisma.bookmark.findMany({
    where: { userId, titleId: { in: titleIds } },
    select: { titleId: true, state: true },
  });
  return new Map(rows.map((row) => [row.titleId, row.state]));
}
