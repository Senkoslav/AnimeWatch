import Form from "next/form";
import Link from "next/link";

import { button, FIELD_COMPACT } from "@/components/ui/controls";
import { MAX_QUERY_LENGTH } from "@/lib/search/query";

import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";

/**
 * Шапка сайта. Серверная целиком: единственный клиентский лист — NavLink ради текущего адреса.
 *
 * Стекло первого уровня — законное: шапка липкая, и под ней реально проезжает страница
 * (docs/04, «Стекло»). Оба сброса приходят вместе с классом.
 *
 * Пункты навигации появляются вместе со страницами: typedRoutes не даст сослаться на
 * несуществующий роут, и список дорастёт, когда появятся расписание и подборки.
 *
 * Мобильное меню вынесено в MobileMenu: там нативный <details>, а не приём со скрытым чекбоксом,
 * как в отборе каталога. Там от <details> пришлось отказаться, потому что на десктопе его надо
 * было принудительно раскрыть, а CSS умеет только прятать. Здесь меню на десктопе не
 * раскрывается, а исчезает целиком, и ограничения нет.
 */
export function SiteHeader() {
  return (
    <header className="glass-chrome sticky top-0 z-20 border-b border-line">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4 lg:h-16">
        {/* «Войти» на телефоне — в нижней панели (components/site/bottom-nav.tsx), здесь его нет. */}
        <MobileMenu label="Меню">
          <nav aria-label="Разделы" className="flex flex-col">
            <NavLink href="/catalog">Каталог</NavLink>
          </nav>
        </MobileMenu>

        {/* Точка — единственный знак различия логотипа. Янтарная, потому что это марка, а не место. */}
        <Link
          href="/"
          className="-mx-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-2 font-display text-lg font-bold tracking-tight"
        >
          animewatch
          <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />
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

        {/* На телефоне «Войти» уходит в меню: в строку 360px оно не встаёт рядом с логотипом и лупой.
            Прячет ссылку обёртка, а не класс на ней же: display-утилиты конфликтовали бы с inline-flex
            из кнопки, и кто победит — зависело бы от порядка правил в собранном CSS, а не от разметки. */}
        <div className="hidden shrink-0 md:block">
          <Link href="/login" className={button("secondary", "sm")}>
            Войти
          </Link>
        </div>
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
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
        <SearchIcon />
      </span>
      <input
        id="site-search"
        name="q"
        type="search"
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Название, жанр, год"
        className={`${FIELD_COMPACT} pr-3 pl-10`}
      />
    </Form>
  );
}
