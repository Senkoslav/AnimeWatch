import Link from "next/link";

import { NavLink } from "./nav-link";

// Пункты навигации появляются вместе со страницами: typedRoutes не даст сослаться на несуществующую.
export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="-mx-2 inline-flex min-h-11 items-center rounded-sm px-2 font-display text-lg font-bold"
        >
          AnimeWatch
        </Link>
        <nav aria-label="Разделы">
          <NavLink href="/catalog">Каталог</NavLink>
        </nav>
        <Link
          href="/search"
          aria-label="Поиск"
          className="ml-auto inline-flex size-11 items-center justify-center rounded-sm text-muted hover:text-text"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="6" strokeWidth="2" />
            <line x1="15.5" y1="15.5" x2="20" y2="20" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
