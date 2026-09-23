"use client";

import { useSyncExternalStore } from "react";

import { decodeDisplayUser, type DisplayUser, readCookie, USER_COOKIE } from "@/lib/auth/display";

/** Событие «вход или выход случился»: у меню две копии, в шапке и в нижней панели. */
export const AUTH_CHANGE_EVENT = "aw:auth-change";

let lastRaw: string | null = null;
let lastUser: DisplayUser | null = null;

function snapshot(): DisplayUser | null {
  const raw = readCookie(document.cookie, USER_COOKIE);
  // Один и тот же объект, пока кука не изменилась: иначе useSyncExternalStore перерисовывал бы вечно.
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastUser = decodeDisplayUser(raw);
  }
  return lastUser;
}

function subscribe(onChange: () => void) {
  // Вход и выход в другой вкладке видны, когда человек вернулся сюда.
  window.addEventListener(AUTH_CHANGE_EVENT, onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

/**
 * Кто вошёл — для шапки, по показной куке (lib/auth/display.ts). На сервере всегда null: страницы
 * статические и о куке не знают, поэтому после загрузки на миг виден «Войти».
 */
export function useDisplayUser(): DisplayUser | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
