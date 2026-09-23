import { prisma } from "@/lib/db";
import { publicTitleWhere } from "@/lib/public-where";

export interface SitemapTitle {
  slug: string;
  updatedAt: Date;
}

/**
 * Тайтлы для sitemap.xml — только публичные: черновик и скрытый по жалобе в карте сайта выдали бы
 * своё существование поисковику. Страниц серий здесь нет намеренно (app/sitemap.ts).
 */
export async function getSitemapTitles(): Promise<SitemapTitle[]> {
  return prisma.title.findMany({
    where: publicTitleWhere(),
    orderBy: { slug: "asc" },
    select: { slug: true, updatedAt: true },
  });
}
