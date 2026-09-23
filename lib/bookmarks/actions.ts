"use server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { WatchState } from "@/lib/generated/prisma/enums";
import {
  type BookmarkView,
  getBookmark,
  removeBookmark,
  setListState,
  setRating,
} from "@/lib/queries/bookmarks";

/**
 * Результат для интерфейса. `signin` — сессии нет или она протухла: кнопка зовёт войти, а не молчит.
 * `unavailable` — тайтла нет или он скрыт. `failed` — сбой на нашей стороне, он в логе.
 */
export type BookmarkResult =
  | { ok: true; bookmark: BookmarkView | null }
  | { ok: false; error: "signin" | "invalid" | "unavailable" | "failed" };

const titleIdSchema = z.cuid();
const stateSchema = z.enum(WatchState);
const ratingSchema = z.int().min(1).max(10).nullable();

/**
 * Общий каркас: сессия первой строкой (правило server actions), затем zod, затем запрос. Ошибка
 * базы не глотается молча: она в логе с контекстом, а интерфейс получает понятный статус.
 */
async function run(
  action: string,
  input: unknown,
  schema: z.ZodType,
  write: (userId: string) => Promise<BookmarkView | null>,
  { nullIsMissing = true }: { nullIsMissing?: boolean } = {},
): Promise<BookmarkResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (!schema.safeParse(input).success) return { ok: false, error: "invalid" };
  try {
    const bookmark = await write(user.id);
    if (bookmark === null && nullIsMissing) return { ok: false, error: "unavailable" };
    return { ok: true, bookmark };
  } catch (error) {
    console.error(`[bookmarks] ${action} не удалось:`, error instanceof Error ? error.message : error);
    return { ok: false, error: "failed" };
  }
}

/** Своя отметка для кнопки на ISR-странице: сама страница о пользователе не знает. */
export async function getMyBookmark(titleId: string): Promise<BookmarkResult> {
  return run("getMyBookmark", titleId, titleIdSchema, (userId) => getBookmark(userId, titleId), {
    nullIsMissing: false,
  });
}

export async function setMyListState(titleId: string, state: WatchState): Promise<BookmarkResult> {
  return run("setMyListState", { titleId, state }, z.object({ titleId: titleIdSchema, state: stateSchema }), (userId) =>
    setListState(userId, titleId, state),
  );
}

/** null — снять оценку. Снятие у тайтла без отметки ничего не создаёт и не ошибка. */
export async function setMyRating(titleId: string, rating: number | null): Promise<BookmarkResult> {
  return run(
    "setMyRating",
    { titleId, rating },
    z.object({ titleId: titleIdSchema, rating: ratingSchema }),
    (userId) => setRating(userId, titleId, rating),
    { nullIsMissing: rating !== null },
  );
}

export async function removeMyBookmark(titleId: string): Promise<BookmarkResult> {
  return run(
    "removeMyBookmark",
    titleId,
    titleIdSchema,
    async (userId) => {
      await removeBookmark(userId, titleId);
      return null;
    },
    { nullIsMissing: false },
  );
}
