"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Клиентский лист только ради usePathname: шапка остаётся серверной.
export function NavLink({ href, children }: { href: Route; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Активный пункт — подчёркивание, не янтарь: янтарь только у того, что идёт прямо сейчас.
      className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm text-muted decoration-2 underline-offset-8 hover:text-text aria-[current=page]:text-text aria-[current=page]:underline"
    >
      {children}
    </Link>
  );
}
