"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Клиентский лист только ради usePathname: шапка остаётся серверной.
export function NavLink({ href, prefetch, children }: { href: Route; prefetch?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={active ? "page" : undefined}
      // Активный пункт — светлая пилюля, не янтарь: раздел это место, а не то, что происходит
      // сейчас, и заливка сигналом здесь обесценила бы сам сигнал (docs/04, «Токены»).
      className="inline-flex min-h-11 items-center rounded-sm px-3.5 text-sm font-medium text-muted hover:bg-fill hover:text-text aria-[current=page]:bg-fill aria-[current=page]:text-text"
    >
      {children}
    </Link>
  );
}
