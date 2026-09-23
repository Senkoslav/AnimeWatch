import type { MetadataRoute } from "next";

/**
 * Манифест: иконка и название, когда сайт добавляют на главный экран телефона. Цвета — значения
 * токенов bg и surface из docs/04: манифест читает система, а не CSS сайта. Иконки собирает
 * scripts/brand/render.mjs из public/brand/mark.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AnimeWatch",
    short_name: "AnimeWatch",
    description: "Каталог аниме: поиск, расписание онгоингов и серии в плеере поставщика",
    start_url: "/",
    display: "standalone",
    // Токен bg из docs/04 значением: манифест читает система телефона, CSS-переменная ей не видна.
    // eslint-disable-next-line no-restricted-syntax -- цвет для системы, а не для разметки сайта
    background_color: "#0b0e13",
    // eslint-disable-next-line no-restricted-syntax -- то же: цвет строки состояния на телефоне
    theme_color: "#0b0e13",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
