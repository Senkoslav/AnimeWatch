import type { MetadataRoute } from "next";

import { getSitemapTitles } from "@/lib/queries/sitemap";
import { titleHref } from "@/lib/routes";
import { siteUrl } from "@/lib/site/url";

// Карта строится из базы: тайтлы меняет только импорт, часа кеша достаточно.
export const revalidate = 3600;

const STATIC_PATHS = ["/", "/catalog", "/schedule", "/dmca", "/terms", "/privacy"] as const;

/**
 * Главная, разделы и все публичные тайтлы. Страниц серий в карте нет: пока нет плеера Kodik, это
 * сотни почти одинаковых страниц «источник не подключён», а тонкие дубли тянут вниз весь сайт.
 * Вернутся в карту вместе с сопоставлением с Kodik (docs/06, фаза F).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const titles = await getSitemapTitles();

  return [
    ...STATIC_PATHS.map((path) => ({ url: new URL(path, base).href })),
    ...titles.map(({ slug, updatedAt }) => ({ url: new URL(titleHref(slug), base).href, lastModified: updatedAt })),
  ];
}
