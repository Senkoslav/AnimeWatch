import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CatalogForm } from "@/components/catalog/catalog-form";
import { CATALOG_PANEL_HEAD } from "@/components/catalog/panel";
import {
  button,
  CHIP_CHECKABLE,
  FIELD,
  FIELD_LABEL,
  FOCUS_WITHIN,
  SEGMENT,
  SEGMENT_ITEM,
} from "@/components/ui/controls";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  activeFilters,
  type CatalogParams,
  DEFAULT_SORT,
  hasFilters,
  KIND_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/catalog/params";
import { formatCount } from "@/lib/format";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { CatalogFilters as FilterOptions } from "@/lib/queries/catalog";
import { MAX_QUERY_LENGTH } from "@/lib/search/query";

interface CatalogFiltersProps {
  params: CatalogParams;
  options: FilterOptions;
  /** Сколько тайтлов под действующим отбором: подпись кнопки, закрывающей лист на телефоне. */
  total: number;
}

const TOGGLE_ID = "catalog-filters-open";
const PANEL_ID = "catalog-filters-panel";

/** Сколько жанров стоит открытыми. Остальные — под «ещё N»: в панели их бывает под полсотни. */
const GENRES_SHOWN = 12;

/**
 * Отбор каталога. Состояние только в URL, страница не отправляется — после смены отбора всегда
 * первая. Применяется сам на каждом изменении (catalog-form.tsx); без JS — GET-форма с кнопкой.
 *
 * На десктопе это липкая колонка слева от выдачи (Catalog.dc.html), на телефоне — нижний лист.
 * И там, и там один и тот же DOM и одна и та же форма: два комплекта полей с одинаковыми именами
 * отправлялись бы оба.
 *
 * Раскрытие — скрытый чекбокс, а не <details>: CSS умеет прятать, но не раскрывать, и содержимое
 * <details> нельзя принудительно показать на широком экране. Роль `dialog` листу не даётся: без JS
 * фокус в нём не удержать, а заявленный диалог, из которого фокус уходит на страницу под ним, хуже
 * честного раскрытия.
 */
export function CatalogFilters({ params, options, total }: CatalogFiltersProps) {
  // Значения вне вариантов сюда не доходят: страница уводит такой адрес на канонический.
  const { genres, years } = options;
  const active = activeFilters(params);

  // Порядок жанров алфавитный и от отбора не зависит: отбор применяется на клике, и чип,
  // уезжающий в начало списка, уходил бы из-под курсора. Отмеченный жанр из хвоста не теряется:
  // хвост с отметкой стоит раскрытым (.details-keep-checked).
  const shownGenres = genres.slice(0, GENRES_SHOWN);
  const hiddenGenres = genres.slice(GENRES_SHOWN);

  return (
    // Без key: панель живёт между переходами, иначе каждый клик по чипу закрывал бы лист на
    // телефоне и сбрасывал фокус. Поля к адресу, пришедшему снаружи формы, подводит CatalogForm.
    // lg:h-full — не оформление: `sticky` держится только внутри родителя, и без полной высоты
    // обёртки панели прилипать некуда — на длинной выдаче она уезжала вверх вместе со страницей.
    <div className="lg:h-full">
      {/* sr-only, а не hidden: элемент должен остаться фокусируемым с клавиатуры. */}
      <input type="checkbox" id={TOGGLE_ID} aria-controls={PANEL_ID} className="peer sr-only lg:hidden" />

      {/*
        Открывашка на телефоне. Счётчик рядом, потому что лист закрыт и отбор иначе не виден.
        Янтарной кнопка становится, только когда отбор задан: действующий фильтр — это «сейчас»,
        а пустая форма ничего не делает и заливку сигнала не заслуживает.
      */}
      <label
        htmlFor={TOGGLE_ID}
        className={`${active.length > 0 ? button() : button("secondary")} w-full cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal lg:hidden`}
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Фильтры
        {active.length > 0 && <span data-numeric="">{active.length}</span>}
      </label>

      {/* Затемнение под листом. Оно же — вторая кнопка закрытия: нажатие мимо листа закрывает его. */}
      <label htmlFor={TOGGLE_ID} className="fixed inset-0 z-30 hidden bg-bg/70 peer-checked:block lg:hidden">
        {/* Подпись текстом, а не aria-label: у <label> нет роли, и ARIA-подписи на нём запрещены. */}
        <span className="sr-only">Закрыть отбор</span>
      </label>

      {/* Липкая панель выше экрана прокручивается внутри себя, областью полей. Сама панель —
          overflow-clip, а не hidden: hidden всё ещё прокручивается скриптом и фокусом, и шапка
          «Отбор» уезжала бы вверх, оставляя пустоту снизу. */}
      <div
        id={PANEL_ID}
        className="sheet-surface fixed inset-x-0 bottom-0 z-40 hidden max-h-[85dvh] flex-col overflow-clip peer-checked:flex lg:sticky lg:inset-x-auto lg:top-sticky lg:bottom-auto lg:z-auto lg:flex lg:max-h-[calc(100dvh_-_var(--spacing-sticky)_-_1rem)]"
      >
        <div className={CATALOG_PANEL_HEAD}>
          <SectionHeading className="mr-auto">Отбор</SectionHeading>
          {hasFilters(params) && (
            <Link href="/catalog" className="inline-flex min-h-11 items-center text-sm text-dim hover:text-text">
              Сбросить
            </Link>
          )}
          {/* Крестик только на телефоне: на десктопе панель не закрывается. */}
          <label
            htmlFor={TOGGLE_ID}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line bg-fill text-text-2 hover:text-text lg:hidden"
          >
            <span className="sr-only">Закрыть отбор</span>
            <X aria-hidden="true" className="size-4" />
          </label>
        </div>

        <CatalogForm className="flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-4 md:p-5">
            {/* Первым и здесь, и в catalogHref: пришедший адрес собирается как есть, и перестановка
                параметров увела бы страницу в вечный редирект. */}
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="catalog-q" className={FIELD_LABEL}>
                Название
              </label>
              <input
                id="catalog-q"
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                maxLength={MAX_QUERY_LENGTH}
                placeholder="Название аниме"
                className={FIELD}
              />
            </div>

            <Group legend="Жанр">
              <div className="flex flex-wrap gap-2">
                {shownGenres.map((genre) => (
                  <CheckChip key={genre} name="genre" value={genre} checked={params.genres.includes(genre)}>
                    {genre}
                  </CheckChip>
                ))}
              </div>
              {hiddenGenres.length > 0 && (
                // Остальные жанры остаются в форме и отправляются наравне с открытыми: <details>
                // прячет их от глаз, но не из разметки.
                <details className="details-keep-checked mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-dim hover:text-text">
                    ещё {hiddenGenres.length}
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {hiddenGenres.map((genre) => (
                      <CheckChip key={genre} name="genre" value={genre} checked={params.genres.includes(genre)}>
                        {genre}
                      </CheckChip>
                    ))}
                  </div>
                </details>
              )}
            </Group>

            <Group legend="Год выхода">
              <div className="flex items-center gap-2">
                <YearSelect name="year_from" label="Год от" value={params.yearFrom} years={years} />
                <span aria-hidden="true" className="text-sm text-dim">
                  —
                </span>
                <YearSelect name="year_to" label="Год до" value={params.yearTo} years={years} />
              </div>
            </Group>

            <Group legend="Статус">
              <div className={SEGMENT}>
                <RadioSegment name="status" value="" checked={!params.status}>
                  Любой
                </RadioSegment>
                {STATUS_OPTIONS.map(([param, status]) => (
                  <RadioSegment key={param} name="status" value={param} checked={params.status === status}>
                    {STATUS_LABELS[status]}
                  </RadioSegment>
                ))}
              </div>
            </Group>

            <Group legend="Тип">
              <div className="flex flex-wrap gap-2">
                {KIND_OPTIONS.map(([param, kind]) => (
                  <CheckChip key={param} name="kind" value={param} checked={params.kinds.includes(kind)}>
                    {KIND_LABELS[kind]}
                  </CheckChip>
                ))}
              </div>
            </Group>

            {/* Сортировка живёт над выдачей ссылками, но обязана пережить отправку формы. */}
            {params.sort !== DEFAULT_SORT && <input type="hidden" name="sort" value={params.sort} />}
          </div>

          {/*
            Низ листа. С JS отбор применяется сам, и кнопки отправки нет: на десктопе низа нет
            вовсе, а на телефоне здесь закрывашка листа со счётом — выдача под листом уже новая.
            Без JS (@media (scripting: none)) — обычная отправка: число на ней соврало бы, оно
            относится к применённому отбору, а не к набранному.
          */}
          {/* Обёртки, а не классы на самих кнопках: button() уже задаёт display, и hidden рядом с
              ним спорил бы порядком утилит в CSS. */}
          <div className="border-t border-line p-4 md:p-5 lg:not-noscript:hidden">
            <div className="noscript:hidden">
              <label htmlFor={TOGGLE_ID} className={`${button()} w-full cursor-pointer`}>
                Показать {formatCount(total, ["тайтл", "тайтла", "тайтлов"])}
              </label>
            </div>
            <div className="not-noscript:hidden">
              <button type="submit" className={`${button()} w-full`}>
                Показать
              </button>
            </div>
          </div>
        </CatalogForm>
      </div>
    </div>
  );
}

/** Группа полей: легенда вместо подписи — так скринридер называет каждый чип внутри группы. */
function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className={`mb-2 ${FIELD_LABEL}`}>{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Чип с чекбоксом внутри. Сам чекбокс sr-only: он остаётся настоящим полем формы, получает фокус
 * и работает с клавиатуры, а видимое состояние рисует подпись.
 */
function CheckChip({
  name,
  value,
  checked,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`cursor-pointer ${FOCUS_WITHIN} ${CHIP_CHECKABLE}`}>
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="sr-only outline-none" />
      {children}
    </label>
  );
}

function RadioSegment({
  name,
  value,
  checked,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`${FOCUS_WITHIN} ${SEGMENT_ITEM}`}>
      <input type="radio" name={name} value={value} defaultChecked={checked} className="sr-only outline-none" />
      {children}
    </label>
  );
}

function YearSelect({
  name,
  label,
  value,
  years,
}: {
  name: string;
  label: string;
  value: number | undefined;
  years: readonly number[];
}) {
  const id = `catalog-${name}`;
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ? String(value) : ""} className={FIELD}>
        <option value="">Любой</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </>
  );
}
