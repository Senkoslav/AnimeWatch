/**
 * Один канонический адрес на каждое состояние страницы. Формы отправляют пустые поля, в ссылках бывает
 * мусор и лишний порядок параметров: страница сравнивает пришедший адрес с каноническим и уводит редиректом.
 */
import type { Route } from "next";

export type SearchParams = Record<string, string | string[] | undefined>;

/** Метки кампаний не часть состояния страницы, но переживают редирект: иначе аналитика потеряет источник. */
const TRACKING_PARAM = /^(utm_[a-z]+|fbclid|gclid|yclid)$/;

function append(query: URLSearchParams, key: string, value: string | string[] | undefined): void {
  for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
    query.append(key, item);
  }
}

/** Адрес запроса в том же виде, в каком пришёл: с ним сравнивается канонический. */
export function requestedHref(pathname: string, searchParams: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) append(query, key, value);
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/** Метки кампаний из запроса парами: нативная GET-форма собирает адрес заново и иначе их теряет. */
export function trackingEntries(searchParams: SearchParams): [string, string][] {
  const tracking = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (TRACKING_PARAM.test(key)) append(tracking, key, value);
  }
  return [...tracking.entries()];
}

/** Канонический адрес с сохранёнными метками кампаний из запроса. */
export function withTracking(href: Route, searchParams: SearchParams): Route {
  const extra = new URLSearchParams(trackingEntries(searchParams)).toString();
  if (!extra) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${extra}` as Route;
}
