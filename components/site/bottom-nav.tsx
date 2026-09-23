"use client";

import { House, LayoutGrid, Search, UserRound, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/auth/account-menu";
import { AuthTrigger } from "@/components/auth/auth-trigger";

interface Item {
  href: Route;
  label: string;
  Icon: LucideIcon;
  /** Главная совпадает только сама с собой: иначе «/» был бы текущим на любой странице. */
  exact?: boolean;
}

const ITEMS: Item[] = [
  { href: "/", label: "Главная", Icon: House, exact: true },
  { href: "/catalog", label: "Каталог", Icon: LayoutGrid },
  { href: "/search", label: "Поиск", Icon: Search },
];

const ITEM = "group flex flex-1 flex-col items-center justify-center gap-1 rounded-md text-dim";
const ICON_BOX = "inline-flex h-7 w-12 items-center justify-center rounded-sm";

/**
 * Нижняя панель на телефоне (Home-mobile.dc.html). Стекло первого уровня: панель висит над
 * прокручиваемой страницей, и под ней реально проезжает содержимое (docs/04, «Стекло»).
 *
 * Текущий пункт — светлой пилюлей, а не янтарём, как и в шапке: раздел — это место, а не то, что
 * происходит сейчас. Последний пункт — «Войти», а у вошедшего «Профиль» с меню аккаунта (страницы
 * профиля ещё нет). Клиентский лист только ради usePathname.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Панель разделов"
      className="glass-chrome fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 rounded-lg border border-line lg:hidden"
    >
      <ul className="flex h-16 items-stretch px-1">
        {ITEMS.map(({ href, label, Icon, exact }) => {
          const current = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`${ITEM} aria-[current=page]:text-text`}
              >
                <span className={`${ICON_BOX} group-aria-[current=page]:bg-fill-2`}>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="text-xs font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <AccountMenu variant="bar" itemClassName={ITEM}>
            <AuthTrigger className={ITEM}>
              <span className={ICON_BOX}>
                <UserRound aria-hidden="true" className="size-5" />
              </span>
              <span className="text-xs font-medium">Войти</span>
            </AuthTrigger>
          </AccountMenu>
        </li>
      </ul>
    </nav>
  );
}
