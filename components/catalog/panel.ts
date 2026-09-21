/**
 * Панель каталога — плотная поверхность: `--surface` с рамкой в 1px на фоне `--bg`.
 *
 * Не стекло. Под ней нет ни изображения, ни прокрученной выдачи — размывать нечего, и стекло
 * здесь было бы украшением, а не материалом (docs/04, «Стекло»).
 */
export const CATALOG_PANEL = "overflow-hidden rounded-lg border border-line bg-surface";

/** Внутренние поля панели. Отдельно от рамки: шапка панели идёт своей строкой, содержимое — нет. */
export const CATALOG_PANEL_BODY = "p-4 md:p-5";

/** Шапка панели: заголовок раздела и действие справа, отбитые линейкой от содержимого. */
export const CATALOG_PANEL_HEAD = "flex items-center gap-3 border-b border-line px-4 py-3";
