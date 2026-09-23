/**
 * Данные страницы профиля (Profile.dc.html). Только то, что сайт действительно знает: списки и
 * свои оценки. Серий и часов просмотра нет — плеер чужой, прогресса мы не видим (docs/06).
 */
import { prisma } from "@/lib/db";
import { type TitleKind, WatchState } from "@/lib/generated/prisma/enums";
import { publicTitleWhere } from "@/lib/public-where";

import { WATCH_STATES } from "@/lib/labels";

/** Сколько последних отметок показывать в «Последнее». */
const RECENT = 8;

export interface ProfileRecent {
  slug: string;
  nameRu: string;
  posterUrl: string | null;
  kind: TitleKind;
  year: number | null;
  state: WatchState;
  rating: number | null;
  updatedAt: Date;
}

export interface Profile {
  memberSince: Date;
  /** Число тайтлов в каждом списке, в порядке docs/04 («Диаграммы»). Нули — тоже строки. */
  lists: { state: WatchState; count: number }[];
  total: number;
  /** Сколько тайтлов получило каждую оценку, от 1 до 10. */
  ratings: number[];
  rated: number;
  /** Средняя своих оценок; null — оценок нет. */
  average: number | null;
  recent: ProfileRecent[];
  /** Для «Продолжить смотреть»: последний отмеченный «Смотрю». */
  continueSlug: string | null;
}

/**
 * Профиль пользователя. Отметки на тайтлах, скрытых по жалобе или снятых в черновик, не считаются:
 * тайтла для зрителя нет, и число в профиле не должно ссылаться в пустоту.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const visible = { userId, title: publicTitleWhere() };

  const [user, byState, byRating, recent, watching] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.bookmark.groupBy({ by: ["state"], where: visible, _count: { _all: true } }),
    prisma.bookmark.groupBy({ by: ["rating"], where: { ...visible, rating: { not: null } }, _count: { _all: true } }),
    prisma.bookmark.findMany({
      where: visible,
      orderBy: [{ updatedAt: "desc" }, { titleId: "asc" }],
      take: RECENT,
      select: {
        state: true,
        rating: true,
        updatedAt: true,
        title: { select: { slug: true, nameRu: true, posterUrl: true, kind: true, year: true } },
      },
    }),
    prisma.bookmark.findFirst({
      where: { ...visible, state: WatchState.WATCHING },
      orderBy: { updatedAt: "desc" },
      select: { title: { select: { slug: true } } },
    }),
  ]);
  if (!user) return null;

  const counts = new Map(byState.map((row) => [row.state, row._count._all]));
  const lists = WATCH_STATES.map((state) => ({ state, count: counts.get(state) ?? 0 }));

  const ratings = Array.from({ length: 10 }, () => 0);
  let sum = 0;
  for (const row of byRating) {
    if (row.rating === null || row.rating < 1 || row.rating > 10) continue;
    ratings[row.rating - 1] = row._count._all;
    sum += row.rating * row._count._all;
  }
  const rated = ratings.reduce((a, b) => a + b, 0);

  return {
    memberSince: user.createdAt,
    lists,
    total: lists.reduce((a, b) => a + b.count, 0),
    ratings,
    rated,
    average: rated > 0 ? sum / rated : null,
    recent: recent.map(({ title, ...bookmark }) => ({ ...title, ...bookmark })),
    continueSlug: watching?.title.slug ?? null,
  };
}
