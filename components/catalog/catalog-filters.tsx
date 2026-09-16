import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  CATALOG_SORTS,
  catalogHref,
  hasFilters,
  kindParam,
  KIND_OPTIONS,
  statusParam,
  STATUS_OPTIONS,
  type CatalogParams,
} from "@/lib/catalog/params";
import { KIND_LABELS, SORT_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { CatalogFilters as FilterOptions } from "@/lib/queries/catalog";

interface CatalogFiltersProps {
  params: CatalogParams;
  options: FilterOptions;
}

/**
 * GET-форма через next/form: без своего JS, состояние только в URL. Страница не
 * отправляется — после смены фильтров всегда первая. Выбранные значения берутся из URL.
 */
export function CatalogFilters({ params, options }: CatalogFiltersProps) {
  // Значения вне вариантов сюда не доходят: страница уводит такой адрес на канонический (sanitizeCatalogParams).
  const { genres, years } = options;

  return (
    // key: при переходе по ссылке «Сбросить» или «Назад» в истории форма пересоздаётся, иначе
    // неуправляемые <select> остались бы с прежними значениями.
    <div key={catalogHref({ ...params, page: 1 })}>
      <Form
        action="/catalog"
        className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
      >
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
        <Field label="Сортировка" name="sort" defaultValue={params.sort}>
          {CATALOG_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </Field>

        <div className="col-span-2 flex items-center gap-4 sm:col-span-1">
          <button
            type="submit"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted lg:flex-none"
          >
            Показать
          </button>
          {hasFilters(params) && (
            <Link href="/catalog" className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted underline">
              Сбросить
            </Link>
          )}
        </div>
      </Form>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue: string;
  children: ReactNode;
}

function Field({ label, name, defaultValue, children }: FieldProps) {
  const id = `catalog-${name}`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        // 16px на телефоне: iOS Safari увеличивает страницу при фокусе на поле с шрифтом мельче.
        className="h-11 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-text sm:text-sm"
      >
        {children}
      </select>
    </div>
  );
}
