import { Search as SearchIcon } from "lucide-react";
import Link from "next/link";

import { AccountMenu } from "@/components/auth/account-menu";
import { LogoMark } from "@/components/site/logo-mark";
import { AuthTrigger } from "@/components/auth/auth-trigger";
import { button, FIELD_COMPACT } from "@/components/ui/controls";

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
      <div className="mx-auto flex h-14 max-w-page items-center gap-2 px-4 lg:px-8 sm:gap-4 lg:h-16">
        {/* «Войти» на телефоне — в нижней панели (components/site/bottom-nav.tsx), здесь его нет. */}
        <MobileMenu label="Меню">
          <nav aria-label="Разделы" className="flex flex-col">
            <NavLink href="/catalog">Каталог</NavLink>
            <NavLink href="/schedule">Расписание</NavLink>
            <NavLink href="/random" prefetch={false}>
              Случайное
            </NavLink>
          </nav>
        </MobileMenu>

        {/*
          Знак и слово. Янтарная перекладина знака — единственный сигнал логотипа, поэтому прежняя
          янтарная точка после слова ушла: два янтарных пятна рядом спорили бы между собой.
        */}
        <Link
          href="/"
          className="-mx-2 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-sm px-2 font-display text-lg font-bold tracking-tight"
        >
          <LogoMark className="size-6 shrink-0" />
          AnimeWatch
        </Link>

        <nav aria-label="Разделы" className="hidden lg:flex lg:items-center lg:gap-1">
          <NavLink href="/catalog">Каталог</NavLink>
          <NavLink href="/schedule">Расписание</NavLink>
          {/* Без предзагрузки: она сама открыла бы /random и выбрала тайтл до нажатия. */}
          <NavLink href="/random" prefetch={false}>
            Случайное
          </NavLink>
        </nav>

        {/* Поле, а не иконка: поиск — вторая причина, по которой сюда приходят, и прятать его незачем. */}
        <Search className="ml-auto hidden w-full max-w-xs md:flex" />

        {/* На телефоне поле не помещается рядом с логотипом, поэтому там лупа: окно поиска, без JS — страница. */}
        <Link
          href="/search"
          prefetch={false}
          data-search-open=""
          aria-label="Поиск"
          className="-mr-2 ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:text-text md:hidden"
        >
          <SearchIcon aria-hidden="true" className="size-5" />
        </Link>

        {/* На телефоне «Войти» уходит в меню: в строку 360px оно не встаёт рядом с логотипом и лупой.
            Прячет ссылку обёртка, а не класс на ней же: display-утилиты конфликтовали бы с inline-flex
            из кнопки, и кто победит — зависело бы от порядка правил в собранном CSS, а не от разметки. */}
        <div className="hidden shrink-0 md:block">
          {/* Вошедшему — аватар с меню: по показной куке, в браузере, чтобы шапка не делала
              страницы динамическими (lib/auth/display.ts). */}
          <AccountMenu variant="header">
            <AuthTrigger className={button("secondary", "sm")}>Войти</AuthTrigger>
          </AccountMenu>
        </div>
      </div>
    </header>
  );
}

/**
 * Поиск в шапке — ссылка, похожая на поле (Title.dc.html: «Поиск аниме» и «Ctrl K»). Щелчок
 * перехватывает окно поиска (components/search/search-dialog.tsx); без JS это переход на /search,
 * где своя форма. Настоящего поля здесь нет: с окном оно ловило бы фокус дважды.
 *
 * prefetch={false}: ссылка видна на каждой странице, а /search динамический — это был бы запрос к
 * базе на каждый просмотр любой страницы сайта.
 */
function Search({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/search"
      prefetch={false}
      data-search-open=""
      aria-keyshortcuts="Control+K Meta+K"
      className={`${FIELD_COMPACT} flex items-center gap-2.5 pr-2 pl-3 text-dim hover:border-fill-2 hover:text-muted ${className}`}
    >
      <SearchIcon aria-hidden="true" className="size-5 shrink-0" />
      <span className="flex-1 truncate">Поиск аниме</span>
      {/* Подсказка сочетания: на Mac окно поиска заменит её на «⌘K». */}
      <kbd
        data-search-kbd=""
        aria-hidden="true"
        className="shrink-0 rounded-[6px] border border-line bg-fill px-1.5 py-0.5 font-sans text-xs text-dim"
      >
        Ctrl K
      </kbd>
    </Link>
  );
}
