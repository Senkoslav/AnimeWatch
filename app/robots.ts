import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site/url";

/**
 * /random — редирект, индексировать нечего; /search — бесконечное пространство запросов.
 * Каталог с `?q=` здесь не закрыт: закрытый в robots.txt адрес робот не откроет и мета-тег
 * `noindex` на нём не увидит, а ссылка в выдаче всё равно могла бы остаться.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/random", "/search"] },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
