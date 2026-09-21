import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";

import { CATALOG_PANEL, CATALOG_PANEL_BODY } from "@/components/catalog/panel";
import { Band } from "@/components/ui/band";
import {
  CATALOG_SORTS,
  catalogHref,
  DEFAULT_SORT,
  hasFilters,
  kindParam,
  KIND_OPTIONS,
  statusParam,
  STATUS_OPTIONS,
  type CatalogParams,
} from "@/lib/catalog/params";
import { KIND_LABELS, SORT_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { CatalogFilters as FilterOptions } from "@/lib/queries/catalog";
import { MAX_QUERY_LENGTH } from "@/lib/search/query";

interface CatalogFiltersProps {
  params: CatalogParams;
  options: FilterOptions;
}

const TOGGLE_ID = "catalog-filters-open";
const FIELDS_ID = "catalog-filters-fields";

/** Поле и подпись одной высоты по всему сайту: колонки в панели должны собираться в линейку. */
const FIELD =
  "h-10 w-full min-w-0 rounded-sm border border-line bg-bg px-2 text-base text-text placeholder:text-muted sm:text-sm";

/**
 * GET-форма через next/form: без своего JS, состояние только в URL. Страница не
 * отправляется — после смены фильтров всегда первая. Выбранные значения берутся из URL.
 *
 * На телефоне панель свёрнута, на десктопе раскрыта всегда. Это скрытый чекбокс, а не
 * <details>: CSS умеет прятать, но не раскрывать, и содержимое <details> нельзя
 * принудительно показать на широком экране — ::details-content поддерживают только
 * свежие браузеры, а без него фильтры на десктопе просто исчезли бы. У чекбокса базовое
 * состояние hidden снимают два независимых правила: peer-checked (телефон) и lg (десктоп).
 */
export function CatalogFilters({ params, options }: CatalogFiltersProps) {
  // Значения вне вариантов сюда не доходят: страница уводит такой адрес на канонический (sanitizeCatalogParams).
  const { genres, years } = options;

  return (
    // key: при переходе по ссылке «Сбросить» или «Назад» в истории панель пересоздаётся, иначе
    // неуправляемые <select> и чекбокс остались бы с прежними значениями.
    <div key={catalogHref({ ...params, page: 1 })} className={`lg:sticky lg:top-sticky ${CATALOG_PANEL}`}>
      {/* sr-only, а не hidden: элемент должен остаться фокусируемым с клавиатуры. */}
      <input
        type="checkbox"
        id={TOGGLE_ID}
        aria-controls={FIELDS_ID}
        // Отбор уже задан — панель открыта, иначе непонятно, почему выдача неполная. Сортировка считается
        // наравне с фильтрами: свёрнутая панель иначе прячет единственный признак, что порядок не обычный.
        defaultChecked={hasFilters(params) || params.sort !== DEFAULT_SORT}
        className="peer sr-only lg:hidden"
      />

      {/* На телефоне полоса раздела работает кнопкой, на десктопе — просто полосой. */}
      <label
        htmlFor={TOGGLE_ID}
        className="flex cursor-pointer items-center justify-between gap-4 bg-ink px-4 py-2 text-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink-bright lg:hidden peer-checked:[&_svg]:rotate-180"
      >
        <span className="font-display text-sm font-bold tracking-tight">Отбор</span>
        {/* Нарисованный шеврон, а не глиф: иконки в проекте рисуются, а не берутся из юникода. */}
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor">
          <path d="M4 6l4 4 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </label>
      <div className="hidden lg:block">
        <Band>Отбор</Band>
      </div>

      <div id={FIELDS_ID} className={`hidden peer-checked:block lg:block ${CATALOG_PANEL_BODY}`}>
        <Form action="/catalog" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {/* Первым и здесь, и в catalogHref: пришедший адрес собирается как есть, и перестановка
              параметров увела бы страницу в вечный редирект на саму себя. */}
          <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-3 lg:col-span-1">
            <label htmlFor="catalog-q" className="text-xs text-muted">
              Поиск по названию
            </label>
            <input
              id="catalog-q"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              maxLength={MAX_QUERY_LENGTH}
              placeholder="Название или часть"
              className={FIELD}
            />
          </div>
          <Field label="Жанр" name="genre" defaultValue={params.genre ?? ""}>
            <option value="">Все</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </Field>
          <Field label="Год" name="year" defaultValue={params.year ? String(params.year) : ""}>
            <option value="">Любой</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Field>
          <Field label="Статус" name="status" defaultValue={params.status ? statusParam(params.status) : ""}>
            <option value="">Любой</option>
            {STATUS_OPTIONS.map(([param, status]) => (
              <option key={param} value={param}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Field>
          <Field label="Тип" name="kind" defaultValue={params.kind ? kindParam(params.kind) : ""}>
            <option value="">Любой</option>
            {KIND_OPTIONS.map(([param, kind]) => (
              <option key={param} value={param}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </Field>
          <Field label="Сортировка" name="sort" defaultValue={params.sort} className="col-span-2 sm:col-span-1">
            {CATALOG_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </Field>

          <div className="col-span-2 flex items-center gap-4 sm:col-span-3 lg:col-span-1 lg:mt-2 lg:flex-col lg:items-stretch lg:gap-2">
            <button
              type="submit"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted lg:flex-none"
            >
              Показать
            </button>
            {hasFilters(params) && (
              <Link
                href="/catalog"
                className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted underline hover:text-text lg:justify-center"
              >
                Сбросить
              </Link>
            )}
          </div>
        </Form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue: string;
  children: ReactNode;
  className?: string;
}

function Field({ label, name, defaultValue, children, className = "" }: FieldProps) {
  const id = `catalog-${name}`;
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {/* 16px на телефоне: iOS Safari увеличивает страницу при фокусе на поле с шрифтом мельче. */}
      <select id={id} name={name} defaultValue={defaultValue} className={FIELD}>
        {children}
      </select>
    </div>
  );
}
