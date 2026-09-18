/**
 * Разбор и сборка поискового запроса. Отдельно от базы: это внешний вход (URL и поле формы),
 * и его правила проверяются юнит-тестами.
 */
import type { Route } from "next";
import { z } from "zod";

/** Длиннее люди не ищут, а триграммный счёт по такой строке только дорожает. */
export const MAX_QUERY_LENGTH = 64;

/** Схлопывает пробелы, убирает управляющие символы, обрезает по длине. Пустой запрос — пустая строка. */
export function normalizeQuery(raw: string | undefined): string {
  return (raw ?? "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

/**
 * Канонический адрес поиска: пустой запрос — просто /search. Кодирование только через URLSearchParams:
 * оно же используется при сборке пришедшего адреса, а `encodeURIComponent` кодирует пробел иначе («%20» против «+»),
 * и редирект на канонический адрес зациклился бы.
 */
export function searchHref(query: string): Route {
  const normalized = normalizeQuery(query);
  return normalized ? `/search?${new URLSearchParams({ q: normalized }).toString()}` : "/search";
}

/**
 * Разбор `q` из адреса: внешний вход, поэтому через zod (`.claude/rules/server.md`). Повторы параметра,
 * массивы и мусор сводятся к одной нормализованной строке, а не роняют страницу.
 */
export const searchQuerySchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .catch(undefined)
  .transform((raw) => normalizeQuery(Array.isArray(raw) ? raw[0] : raw));
