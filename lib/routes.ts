/**
 * Адреса публичных страниц. Собираются только здесь, чтобы формат URL менялся в одном месте.
 */
import type { Route } from "next";

export function titleHref(slug: string): Route<`/anime/${string}`> {
  return `/anime/${encodeURIComponent(slug)}`;
}

export type EpisodeRoute = Route<`/anime/${string}/${number}`>;

export function episodeHref(slug: string, episode: number): EpisodeRoute {
  return `/anime/${encodeURIComponent(slug)}/${episode}`;
}
