"use server";

import { cookies } from "next/headers";

import { SESSION_COOKIE, USER_COOKIE } from "./display";
import { deleteSession } from "./session";

export interface SignOutState {
  /** Момент выхода: меню по его смене перечитывает показную куку во всех своих копиях. */
  signedOutAt: number | null;
}

/**
 * Выход. Первым делом — сессия из куки (правило server actions): её строка удаляется, и токен
 * больше ничего не открывает, даже если куку сохранили. Потом снимаются обе куки.
 */
export async function signOut(): Promise<SignOutState> {
  const store = await cookies();
  await deleteSession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  store.delete(USER_COOKIE);
  return { signedOutAt: Date.now() };
}
