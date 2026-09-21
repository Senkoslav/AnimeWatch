/**
 * Панель каталога — лист печатного картона: --surface с рамкой в 1px на фоне --bg.
 * overflow-hidden, потому что полоса раздела заливается краской от края до края и обязана
 * обрезаться по скруглению панели, а не торчать углами.
 */
export const CATALOG_PANEL = "overflow-hidden rounded-md border border-line bg-surface";

/** Внутренние поля панели. Отдельно от рамки: полоса раздела идёт от края до края, содержимое — нет. */
export const CATALOG_PANEL_BODY = "p-4 md:p-5";
