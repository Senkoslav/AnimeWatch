import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TitleCard } from "@/components/catalog/title-card";
import { button, FIELD, PAGE_TITLE, TEXT_LINK } from "@/components/ui/controls";
import { requestedHref, trackingEntries, withTracking } from "@/lib/canonical";
import { myListStates } from "@/lib/bookmarks/list-states";
import { formatCount } from "@/lib/format";
import { SEARCH_LIMIT, searchTitles } from "@/lib/queries/search";
import { MAX_QUERY_LENGTH, searchHref, searchQuerySchema } from "@/lib/search/query";

// Страница результатов не индексируется: у поиска бесконечное число адресов, и краулер грузил бы базу.
export const metadata: Metadata = { title: "Поиск", robots: { index: false, follow: true } };

/** Колонок сетки на телефоне: первый ряд виден без прокрутки. */
const MOBILE_COLUMNS = 2;

// Рендер динамический: запрос в searchParams (docs/02, «Кеширование»).
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const query = searchQuerySchema.parse(params.q);

  // Один адрес на один запрос: форма отправляет и пустое поле, в ссылках бывает мусор и лишние параметры.
  const canonical = withTracking(searchHref(query), params);
  if (requestedHref("/search", params) !== canonical) {
    redirect(canonical);
  }

  const { titles, truncated } = query ? await searchTitles(query) : { titles: [], truncated: false };
  const listStates = await myListStates(titles.map((title) => title.id));

  return (
    <div className="mx-auto max-w-page px-4 lg:px-8 py-6 md:py-10">
      <h1 className={PAGE_TITLE}>Поиск</h1>

      <Form action="/search" className="mt-6 flex max-w-xl flex-wrap items-center gap-3">
        {trackingEntries(params).map(([key, value]) => (
          <input key={`${key}=${value}`} type="hidden" name={key} value={value} />
        ))}
        <label htmlFor="search-query" className="sr-only">
          Название аниме
        </label>
        <input
          id="search-query"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Название аниме"
          className={`${FIELD} flex-1`}
        />
        <button type="submit" className={button()}>
          Найти
        </button>
      </Form>

      {!query ? (
        <p className="mt-12 text-muted">
          Введите название: подойдут и русское, и оригинальное. Или посмотрите{" "}
          <Link href="/catalog" className={TEXT_LINK}>
            каталог
          </Link>
          .
        </p>
      ) : titles.length > 0 ? (
        <section aria-labelledby="search-results" className="mt-8">
          <h2 id="search-results" className="text-sm text-muted">
            {truncated
              ? `Показаны первые ${formatCount(SEARCH_LIMIT, ["тайтл", "тайтла", "тайтлов"])}: уточните запрос`
              : `Найдено ${formatCount(titles.length, ["тайтл", "тайтла", "тайтлов"])}`}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {titles.map((title, index) => (
              <li key={title.id}>
                <TitleCard title={title} eager={index < MOBILE_COLUMNS} listState={listStates.get(title.id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-12 space-y-3">
          <h2 className="text-lg font-semibold">Ничего не нашлось</h2>
          <p className="text-muted">
            Проверьте название или посмотрите{" "}
            <Link href="/catalog" className={TEXT_LINK}>
              каталог
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
