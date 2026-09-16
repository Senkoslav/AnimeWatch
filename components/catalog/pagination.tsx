import Link from "next/link";

import { catalogHref, type CatalogParams } from "@/lib/catalog/params";

interface PaginationProps {
  params: CatalogParams;
  pageCount: number;
}

const LINK = "inline-flex min-h-11 items-center rounded-sm border border-line px-4 text-sm hover:bg-surface-2";

/** «Назад» и «Дальше» ссылками: страница в URL, каждая открывается сама по себе. */
export function Pagination({ params, pageCount }: PaginationProps) {
  const { page } = params;
  if (pageCount <= 1 || page > pageCount) return null;

  return (
    <nav aria-label="Страницы каталога" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={catalogHref({ ...params, page: page - 1 })} rel="prev" className={LINK}>
          Назад
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted">
        Страница {page} из {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={catalogHref({ ...params, page: page + 1 })} rel="next" className={LINK}>
          Дальше
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
