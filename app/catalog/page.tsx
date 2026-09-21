import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { Pagination } from "@/components/catalog/pagination";
import { TitleCard } from "@/components/catalog/title-card";
import { CHIP, CHIP_ACTIVE, PAGE_TITLE, TEXT_LINK } from "@/components/ui/controls";
import { withTracking } from "@/lib/canonical";
import {
  activeFilters,
  type CatalogParams,
  CATALOG_PRESETS,
  CATALOG_SORTS,
  catalogHref,
  hasFilters,
  isPresetActive,
  parseCatalogParams,
  presetHref,
  requestedCatalogHref,
  sanitizeCatalogParams,
} from "@/lib/catalog/params";
import { shownRange } from "@/lib/catalog/pages";
import { formatCount } from "@/lib/format";
import { SORT_LABELS } from "@/lib/labels";
import { CATALOG_PAGE_SIZE, getCatalog, getCatalogFilters } from "@/lib/queries/catalog";
import { CATALOG_MATCH_LIMIT } from "@/lib/queries/search";

/**
 * Адрес с поиском из индекса убираем, как и `/search`: `q` — произвольная строка, значит адресов
 * бесконечно много, и каждый — полный скан `Title`. Фильтры индексируются: их значения конечны и
 * проверены по каталогу (sanitizeCatalogParams).
 */
export async function generateMetadata({ searchParams }: PageProps<"/catalog">): Promise<Metadata> {
  const { q } = parseCatalogParams(await searchParams);
  return q ? { title: "Каталог", robots: { index: false, follow: true } } : { title: "Каталог" };
}

/** Колонок сетки на телефоне: первый ряд виден без прокрутки. */
const MOBILE_COLUMNS = 2;

/** Сетка уже, чем на поиске: справа стоит панель отбора в 19rem. */
const POSTER_SIZES = "(min-width: 1280px) 190px, (min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw";

// Рендер динамический: фильтры в searchParams (docs/02, «Кеширование»).
export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const query = await searchParams;
  const parsed = parseCatalogParams(query);
  const [options, catalog] = await Promise.all([getCatalogFilters(), getCatalog(parsed)]);
  const params = sanitizeCatalogParams(parsed, options);

  // Один канонический адрес на каждое состояние: форма отправляет пустые поля (?status=&year_from=), в ссылках
  // бывает мусор, неизвестный жанр или страница за последней. Метки кампаний сохраняются. Разбор канонического
  // адреса даёт те же параметры, так что петли нет; если жанр отброшен, выдача пересчитается уже по чистому адресу.
  const canonical = withTracking(catalogHref({ ...params, page: Math.min(params.page, catalog.pageCount) }), query);
  if (requestedCatalogHref(query) !== canonical) {
    redirect(canonical);
  }

  const active = activeFilters(params);
  const range = shownRange(params.page, CATALOG_PAGE_SIZE, catalog.total);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className={PAGE_TITLE}>Каталог</h1>
        <p className="text-sm text-dim">{formatCount(catalog.total, ["тайтл", "тайтла", "тайтлов"])}</p>
      </div>

      {/* Пресеты — готовые наборы параметров ссылками, а не новый механизм отбора. */}
      <nav aria-label="Подборки" className="mt-4 flex flex-wrap gap-2">
        {CATALOG_PRESETS.map((preset) => {
          const current = isPresetActive(params, preset);
          return (
            <Link
              key={preset.name}
              href={presetHref(preset)}
              aria-current={current ? "page" : undefined}
              className={current ? CHIP_ACTIVE : CHIP}
            >
              {preset.name}
            </Link>
          );
        })}
      </nav>

      {/* Фильтры первыми в DOM — сначала отбор, потом результат, это и порядок чтения скринридером.
          Вправо их ставит явная раскладка грида, а не порядок разметки. */}
      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-6">
        <div className="lg:col-start-2 lg:row-start-1 lg:h-full">
          <CatalogFilters params={params} options={options} />
        </div>

        <section
          aria-labelledby="catalog-results"
          className="mt-6 min-w-0 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:self-start"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <p id="catalog-results" className="text-sm text-muted">
              {catalog.total === 0 ? (
                "Ничего не нашлось"
              ) : (
                <>
                  Показано{" "}
                  <span data-numeric="">
                    {range.from}–{range.to}
                  </span>{" "}
                  из <span data-numeric="">{catalog.total}</span>
                </>
              )}
            </p>
            <SortMenu params={params} />
          </div>

          {/* Метки действующего отбора: снять один фильтр должно быть так же просто, как поставить. */}
          {active.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ul aria-label="Действующий отбор" className="flex flex-wrap gap-2">
                {active.map((filter) => (
                  <li key={filter.key}>
                    <Link href={filter.href} className={CHIP}>
                      {filter.label}
                      <span className="sr-only"> — снять</span>
                      <CloseIcon />
                    </Link>
                  </li>
                ))}
              </ul>
              {/* Сброс всего — здесь, а не в панели: на телефоне панель закрыта, и из неё
                  «Сбросить» было бы недостижимо, пока лист не открыт. Вне списка меток: это не
                  ещё один отбор, который можно снять. */}
              <Link
                href="/catalog"
                className="inline-flex min-h-11 items-center px-2 text-sm text-dim underline hover:text-text sm:min-h-9"
              >
                Сбросить
              </Link>
            </div>
          )}

          {catalog.truncated && (
            // При обрезке счётчик считает внутри отобранных совпадений: писать его числом по
            // каталогу значило бы соврать, поэтому говорим, что показано, и что с этим делать.
            <p className="mt-3 text-sm text-dim">
              Показаны первые {formatCount(CATALOG_MATCH_LIMIT, ["совпадение", "совпадения", "совпадений"])}, из них
              подходит {catalog.total}: уточните запрос.
            </p>
          )}

          {catalog.items.length > 0 ? (
            <>
              <ul
                aria-label="Найденные тайтлы"
                className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4"
              >
                {catalog.items.map((title, index) => (
                  <li key={title.id}>
                    <TitleCard title={title} sizes={POSTER_SIZES} eager={params.page === 1 && index < MOBILE_COLUMNS} />
                  </li>
                ))}
              </ul>
              <Pagination params={params} pageCount={catalog.pageCount} />
            </>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-line p-6">
              <p className="text-lg font-semibold">Здесь пока пусто</p>
              <p className="mt-2 max-w-[60ch] text-muted">
                {hasFilters(params) ? (
                  <>
                    Попробуйте снять один из фильтров или{" "}
                    <Link href="/catalog" className={TEXT_LINK}>
                      посмотреть весь каталог
                    </Link>
                    .
                  </>
                ) : (
                  "Каталог ещё наполняется. Загляните чуть позже."
                )}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Сортировка — список ссылок, а не поле формы: полем она требовала бы отдельной кнопки отправки,
 * а ссылка работает и без JS, и из панели отбора её значение переносится скрытым полем.
 *
 * key: <details> раскрывает браузер, и при клиентском переходе React не сбросил бы атрибут open —
 * меню осталось бы висеть поверх новой выдачи. Тот же приём, что у панели отбора.
 */
function SortMenu({ params }: { params: CatalogParams }) {
  return (
    <details key={catalogHref(params)} className="relative ml-auto">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-fill px-3 text-sm text-text-2 hover:text-text [&::-webkit-details-marker]:hidden">
        <span className="text-dim">Сортировка</span>
        {SORT_LABELS[params.sort]}
        <ChevronIcon />
      </summary>
      <ul className="glass-modal absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-md border border-line p-1">
        {CATALOG_SORTS.map((sort) => {
          const current = sort === params.sort;
          return (
            <li key={sort}>
              <Link
                href={catalogHref({ ...params, sort, page: 1 })}
                aria-current={current ? "true" : undefined}
                className={`flex min-h-11 items-center rounded-sm px-3 text-sm ${current ? "bg-signal-soft text-signal" : "text-text-2 hover:bg-fill"}`}
              >
                {SORT_LABELS[sort]}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Иконки рисуются, а не берутся из юникода: глиф зависит от шрифта и на телефоне бывает эмодзи. */
function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3 text-dim" fill="none" stroke="currentColor">
      <path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5 shrink-0 text-dim"
      fill="none"
      stroke="currentColor"
    >
      <path d="M4 6l4 4 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
