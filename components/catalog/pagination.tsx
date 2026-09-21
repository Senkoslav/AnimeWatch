import Link from "next/link";

import { catalogHref, type CatalogParams } from "@/lib/catalog/params";
import { PAGE_GAP, pageWindow } from "@/lib/catalog/pages";

interface PaginationProps {
  params: CatalogParams;
  pageCount: number;
}

/** Тач-цель 44×44 и на номере из одной цифры: ширина задана минимумом, а не отступами. */
const SLOT = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 text-sm";
const LINK = `${SLOT} border border-line text-text-2 hover:bg-fill hover:text-text`;

/**
 * Номера страниц ссылками: каждая страница открывается сама по себе и переживает вкладку.
 *
 * Текущая залита янтарём — это то место выдачи, где зритель находится прямо сейчас, и
 * единственное состояние на полосе, которое вообще что-то значит.
 */
export function Pagination({ params, pageCount }: PaginationProps) {
  const { page } = params;
  if (pageCount <= 1 || page > pageCount) return null;

  return (
    <nav aria-label="Страницы каталога" className="mt-8 flex flex-wrap items-center gap-2">
      {page > 1 && (
        <Link href={catalogHref({ ...params, page: page - 1 })} rel="prev" className={LINK}>
          Назад
        </Link>
      )}

      {pageWindow(page, pageCount).map((slot, index) =>
        slot === PAGE_GAP ? (
          // Многоточие — не ссылка: за ним нет одной страницы, на которую можно перейти.
          <span key={`gap-${index}`} aria-hidden="true" className={`${SLOT} text-dim`}>
            …
          </span>
        ) : slot === page ? (
          <span key={slot} aria-current="page" className={`${SLOT} bg-signal font-semibold text-signal-ink`}>
            <span className="sr-only">Страница </span>
            <span data-numeric="">{slot}</span>
          </span>
        ) : (
          <Link key={slot} href={catalogHref({ ...params, page: slot })} className={LINK}>
            <span className="sr-only">Страница </span>
            <span data-numeric="">{slot}</span>
          </Link>
        ),
      )}

      {page < pageCount && (
        <Link href={catalogHref({ ...params, page: page + 1 })} rel="next" className={LINK}>
          Дальше
        </Link>
      )}
    </nav>
  );
}
