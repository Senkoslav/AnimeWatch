import Form from "next/form";
import Link from "next/link";

import { MAX_QUERY_LENGTH } from "@/lib/search/query";

import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";

/**
 * Шапка сайта. Серверная целиком: единственный клиентский лист — NavLink ради текущего адреса.
 *
 * Пункты навигации появляются вместе со страницами: typedRoutes не даст сослаться на
 * несуществующий роут, и список дорастёт, когда появятся расписание и подборки.
 *
 * Мобильное меню вынесено в MobileMenu: там нативный <details>, а не приём со скрытым чекбоксом,
 * как в фильтрах каталога. Там от <details> пришлось отказаться, потому что на десктопе его надо
 * было принудительно раскрыть, а CSS умеет только прятать. Здесь меню на десктопе не
 * раскрывается, а исчезает целиком, и ограничения нет.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <MobileMenu label="Меню">
          <nav aria-label="Разделы" className="flex flex-col">
            <NavLink href="/catalog">Каталог</NavLink>
          </nav>
          <Link
            href="/login"
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted"
          >
            Войти
          </Link>
        </MobileMenu>

        <Link
          href="/"
          className="-mx-2 inline-flex min-h-11 shrink-0 items-center rounded-sm px-2 font-display text-lg font-bold"
        >
          AnimeWatch
        </Link>

        <nav aria-label="Разделы" className="hidden lg:flex lg:items-center lg:gap-1">
          <NavLink href="/catalog">Каталог</NavLink>
        </nav>

        {/* Поле, а не иконка: поиск — вторая причина, по которой сюда приходят, и прятать его незачем. */}
        <Search className="ml-auto hidden w-full max-w-xs md:block" />

        {/* На телефоне поле не помещается рядом с логотипом, поэтому там лупа на страницу поиска. */}
        <Link
          href="/search"
          aria-label="Поиск"
          className="-mr-2 ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:text-text md:hidden"
        >
          <SearchIcon />
        </Link>

        {/* На телефоне «Войти» уходит в меню: в строку 360px оно не встаёт рядом с логотипом и лупой. */}
        <Link
          href="/login"
          className="-mr-2 hidden min-h-11 shrink-0 items-center rounded-sm px-2 text-sm font-medium hover:text-muted md:inline-flex"
        >
          Войти
        </Link>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor">
      <circle cx="11" cy="11" r="6" strokeWidth="2" />
      <line x1="15.5" y1="15.5" x2="20" y2="20" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * GET-форма без своего JS: работает и до того, как появится модалка поиска.
 *
 * prefetch={false}: форма видна на каждой странице, а next/form по умолчанию подгружает адрес
 * действия, как только форма появилась в кадре. `/search` динамический, и это был бы запрос к базе
 * на каждый просмотр любой страницы сайта.
 */
function Search({ className = "" }: { className?: string }) {
  return (
    <Form action="/search" prefetch={false} className={`relative ${className}`}>
      <label htmlFor="site-search" className="sr-only">
        Поиск аниме
      </label>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
        <SearchIcon />
      </span>
      <input
        id="site-search"
        name="q"
        type="search"
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Поиск аниме"
        // 16px на телефоне: iOS Safari увеличивает страницу при фокусе на поле с шрифтом мельче.
        className="h-11 w-full rounded-sm border border-line bg-surface pr-3 pl-10 text-base text-text placeholder:text-muted sm:text-sm"
      />
    </Form>
  );
}
