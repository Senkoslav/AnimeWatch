/**
 * Адреса публичных страниц. Собираются только здесь, чтобы формат URL менялся в одном месте.
 */
import type { Route } from "next";

export function titleHref(slug: string): Route<`/anime/${string}`> {
  return `/anime/${encodeURIComponent(slug)}`;
}

// Страницы серии ещё нет (задача «Плеер»), а typedRoutes не пропускает ссылку на несуществующий роут.
// Когда страница появится, убрать приведение к Route: пусть адрес проверяет typedRoutes.
export function episodeHref(slug: string, episode: number): Route {
  return `/anime/${encodeURIComponent(slug)}/${episode}` as Route;
}
