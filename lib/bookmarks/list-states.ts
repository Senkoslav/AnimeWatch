import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import type { WatchState } from "@/lib/generated/prisma/enums";
import { getBookmarkStates } from "@/lib/queries/bookmarks";

/**
 * Свои отметки для карточек выдачи. Только для динамических страниц (каталог, поиск): чтение
 * сессии делает страницу динамической, а они такие и так. Аноним — пустая карта без запроса.
 */
export async function myListStates(titleIds: string[]): Promise<Map<string, WatchState>> {
  const user = await getCurrentUser();
  return user ? getBookmarkStates(user.id, titleIds) : new Map();
}
