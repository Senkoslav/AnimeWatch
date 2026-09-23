/**
 * Общие поля Open Graph. Next сливает метаданные страницы с лэйаутом поверхностно: свой `openGraph`
 * у страницы заменяет корневой целиком, поэтому страницы подмешивают эти поля к своим.
 */
export const OPEN_GRAPH_BASE = { siteName: "AnimeWatch", locale: "ru_RU" } as const;
