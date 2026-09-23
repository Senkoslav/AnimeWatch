"use client";

import { useEffect, useSyncExternalStore } from "react";

import { AUTH_CHANGE_EVENT } from "@/components/auth/use-display-user";
import { type BookmarkResult, getMyBookmark } from "@/lib/bookmarks/actions";
import { USER_COOKIE } from "@/lib/auth/display";
import type { BookmarkView } from "@/lib/queries/bookmarks";

/**
 * Своя отметка тайтла в браузере. Кнопка списков и оценка стоят на странице тайтла в разных
 * местах и обязаны показывать одно и то же, поэтому состояние общее, по titleId.
 *
 * Страница тайтла статическая (ISR) и о пользователе не знает: отметка подгружается server action
 * после загрузки. Правка применяется сразу и откатывается, если сервер её не принял.
 */
export interface BookmarkEntry {
  status: "loading" | "ready" | "error";
  bookmark: BookmarkView | null;
  /** Что случилось, словами: показывается рядом с кнопкой (docs/04, «Текст в интерфейсе»). */
  message: string | null;
}

const LOADING: BookmarkEntry = { status: "loading", bookmark: null, message: null };

const entries = new Map<string, BookmarkEntry>();
const listeners = new Map<string, Set<() => void>>();
const requested = new Set<string>();

function emit(titleId: string) {
  for (const listener of listeners.get(titleId) ?? []) listener();
}

function update(titleId: string, entry: BookmarkEntry) {
  entries.set(titleId, entry);
  emit(titleId);
}

const MESSAGES = {
  invalid: "Не получилось сохранить: обновите страницу и попробуйте ещё раз.",
  unavailable: "Этот тайтл сейчас недоступен, отметить его нельзя.",
  failed: "Не получилось сохранить. Попробуйте ещё раз через минуту.",
} as const;

/**
 * Сессия кончилась, а показная кука осталась: снимаем её, и шапка с кнопками честно зовут войти.
 * Удалить httpOnly-куку отсюда нельзя, но она и так уже ничего не открывает.
 */
function forgetSignedIn() {
  document.cookie = `${USER_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function applyResult(titleId: string, result: BookmarkResult, previous: BookmarkView | null) {
  if (result.ok) {
    update(titleId, { status: "ready", bookmark: result.bookmark, message: null });
    return;
  }
  if (result.error === "signin") forgetSignedIn();
  update(titleId, {
    status: "ready",
    bookmark: previous,
    message: result.error === "signin" ? null : MESSAGES[result.error],
  });
}

async function load(titleId: string) {
  if (requested.has(titleId)) return;
  requested.add(titleId);
  try {
    applyResult(titleId, await getMyBookmark(titleId), null);
  } catch {
    // Сеть отвалилась: отметка неизвестна, но кнопка остаётся рабочей — выбор её перезапишет.
    update(titleId, { status: "ready", bookmark: null, message: MESSAGES.failed });
  }
}

/** Правка отметки: сразу на экране, потом на сервере, при отказе — назад с объяснением. */
export async function mutate(
  titleId: string,
  optimistic: BookmarkView | null,
  request: () => Promise<BookmarkResult>,
): Promise<BookmarkResult | null> {
  const previous = entries.get(titleId)?.bookmark ?? null;
  update(titleId, { status: "ready", bookmark: optimistic, message: null });
  try {
    const result = await request();
    applyResult(titleId, result, previous);
    return result;
  } catch {
    update(titleId, { status: "ready", bookmark: previous, message: MESSAGES.failed });
    return null;
  }
}

export function useBookmark(titleId: string, signedIn: boolean): BookmarkEntry {
  const entry = useSyncExternalStore(
    (listener) => {
      const set = listeners.get(titleId) ?? new Set();
      set.add(listener);
      listeners.set(titleId, set);
      return () => set.delete(listener);
    },
    () => entries.get(titleId) ?? LOADING,
    () => LOADING,
  );

  useEffect(() => {
    if (signedIn) void load(titleId);
    else {
      // Вышел или сессия кончилась: при следующем входе отметку нужно спросить заново.
      requested.delete(titleId);
      entries.delete(titleId);
    }
  }, [titleId, signedIn]);

  return entry;
}
