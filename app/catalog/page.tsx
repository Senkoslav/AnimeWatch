import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { Pagination } from "@/components/catalog/pagination";
import { TitleCard } from "@/components/catalog/title-card";
import { catalogHref, hasFilters, parseCatalogParams, requestedCatalogHref } from "@/lib/catalog/params";
import { formatCount } from "@/lib/format";
import { getCatalog, getCatalogFilters } from "@/lib/queries/catalog";

export const metadata: Metadata = { title: "Каталог" };

/** Колонок сетки на телефоне: первый ряд виден без прокрутки. */
const MOBILE_COLUMNS = 2;

// Рендер динамический: фильтры в searchParams (docs/02, «Кеширование»).
export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const query = await searchParams;
  const params = parseCatalogParams(query);
  // Форма отправляет и пустые поля (?genre=&year=), в ссылках бывает мусор: ведём на чистый адрес,
  // чтобы делились всегда им. Разбор канонического адреса даёт те же params, так что петли нет.
  const canonical = catalogHref(params);
  if (requestedCatalogHref(query) !== canonical) {
    redirect(canonical);
  }
  const [catalog, options] = await Promise.all([getCatalog(params), getCatalogFilters()]);
  const beyondLastPage = params.page > catalog.pageCount;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <h1 className="text-xl font-semibold">Каталог</h1>

      <div className="mt-6">
        <CatalogFilters params={params} options={options} />
      </div>

      {catalog.items.length > 0 ? (
        <section aria-labelledby="catalog-results" className="mt-8">
          <h2 id="catalog-results" className="text-sm text-muted">
            Найдено {formatCount(catalog.total, ["тайтл", "тайтла", "тайтлов"])}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {catalog.items.map((title, index) => (
              <li key={title.id}>
                <TitleCard title={title} eager={params.page === 1 && index < MOBILE_COLUMNS} />
              </li>
            ))}
          </ul>
          <Pagination params={params} pageCount={catalog.pageCount} />
        </section>
      ) : (
        <section className="mt-12 space-y-3">
          {beyondLastPage && catalog.total > 0 ? (
            <>
              <h2 className="text-lg">Такой страницы нет</h2>
              <Link href={catalogHref({ ...params, page: 1 })} className="inline-flex min-h-11 items-center underline">
                К первой странице
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-lg">Ничего не нашлось</h2>
              {hasFilters(params) && (
                <p className="text-muted">
                  Попробуйте убрать один из фильтров или{" "}
                  <Link href="/catalog" className="text-text underline">
                    сбросьте все
                  </Link>
                  .
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
