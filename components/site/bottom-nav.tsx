"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface Item {
  href: Route;
  label: string;
  icon: ReactNode;
  /** Главная совпадает только сама с собой: иначе «/» был бы текущим на любой странице. */
  exact?: boolean;
}

const ICON = "size-5";

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Главная",
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={ICON} fill="none" stroke="currentColor">
        <path d="M4 11l8-6 8 6v8H4z" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/catalog",
    label: "Каталог",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={ICON} fill="none" stroke="currentColor">
        <rect x="4" y="4" width="7" height="16" rx="1.5" strokeWidth="2" />
        <rect x="13" y="4" width="7" height="9" rx="1.5" strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Поиск",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={ICON} fill="none" stroke="currentColor">
        <circle cx="11" cy="11" r="6" strokeWidth="2" />
        <line x1="15.5" y1="15.5" x2="20" y2="20" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    // Профиля ещё нет, поэтому пункт честно называется «Войти» и открывает нижний лист входа.
    href: "/login",
    label: "Войти",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={ICON} fill="none" stroke="currentColor">
        <circle cx="12" cy="9" r="3.4" strokeWidth="2" />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

/**
 * Нижняя панель на телефоне (Home-mobile.dc.html). Стекло первого уровня: панель висит над
 * прокручиваемой страницей, и под ней реально проезжает содержимое (docs/04, «Стекло»).
 *
 * Текущий пункт — светлой пилюлей, а не янтарём, как и в шапке: раздел — это место, а не то, что
 * происходит сейчас. Клиентский лист только ради usePathname.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Панель разделов"
      className="glass-chrome fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 rounded-lg border border-line lg:hidden"
    >
      <ul className="flex h-16 items-stretch px-1">
        {ITEMS.map(({ href, label, icon, exact }) => {
          const current = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-md text-dim aria-[current=page]:text-text"
              >
                <span className="inline-flex h-7 w-12 items-center justify-center rounded-sm group-aria-[current=page]:bg-fill-2">
                  {icon}
                </span>
                <span className="text-xs font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
