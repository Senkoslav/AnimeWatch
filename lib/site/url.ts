/**
 * Адрес сайта для metadataBase, canonical, robots.txt и sitemap.xml.
 *
 * Первым — NEXT_PUBLIC_SITE_URL. Не задан — системный VERCEL_PROJECT_PRODUCTION_URL: его Vercel
 * ставит сам (без схемы, «animewatch-gamma.vercel.app»), так прод получает свой адрес, даже если
 * env забыли. Он же у превью: canonical превью ведёт на прод, и превью не индексируется как
 * отдельный сайт. Локально — localhost.
 */
import { z } from "zod";

const LOCAL = "http://localhost:3000";

const httpUrl = z.url({ protocol: /^https?$/ });

export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const production = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidates = [env.NEXT_PUBLIC_SITE_URL?.trim(), production ? `https://${production}` : undefined];
  for (const candidate of candidates) {
    const parsed = httpUrl.safeParse(candidate);
    // Только происхождение: путь в env («https://site/ru») сдвинул бы все относительные адреса.
    if (parsed.success) return new URL(new URL(parsed.data).origin);
  }
  return new URL(LOCAL);
}
