/**
 * Адреса публичных страниц. Собираются только здесь, чтобы формат URL менялся в одном месте.
 */
import type { Route } from "next";

// Страниц тайтла и серии ещё нет (задачи «Страница тайтла» и «Плеер» в фазе 3), а typedRoutes не пропускает
// ссылку на несуществующий роут. Когда страницы появятся, убрать приведение к Route: пусть адреса проверяет typedRoutes.

export function titleHref(slug: string): Route {
  return `/anime/${encodeURIComponent(slug)}` as Route;
}

export function episodeHref(slug: string, episode: number): Route {
  return `/anime/${encodeURIComponent(slug)}/${episode}` as Route;
}
