"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useRef } from "react";

import { AUTH_CHANGE_EVENT, useDisplayUser } from "@/components/auth/use-display-user";
import { useDismissableDetails } from "@/components/ui/use-dismissable-details";
import { signOut, type SignOutState } from "@/lib/auth/actions";
import type { DisplayUser } from "@/lib/auth/display";

interface AccountMenuProps {
  /** Шапка — меню вниз и имя рядом с аватаром; нижняя панель — меню вверх, подпись под иконкой. */
  variant: "header" | "bar";
  /** Что показать, пока никто не вошёл: кнопка «Войти», собранная на сервере. */
  children: ReactNode;
  /** Классы пункта нижней панели: у него своя сетка. */
  itemClassName?: string;
}

const INITIAL: SignOutState = { signedOutAt: null };

/**
 * Аватар и меню профиля вместо «Войти». Меню — стекло третьего уровня (docs/04: «меню профиля»),
 * `<details>`, чтобы открываться без своего состояния. В меню имя, e-mail, «Профиль» и «Выйти».
 */
export function AccountMenu({ variant, children, itemClassName = "" }: AccountMenuProps) {
  const user = useDisplayUser();
  const menu = useRef<HTMLDetailsElement>(null);
  const [state, formAction, pending] = useActionState(signOut, INITIAL);

  // Выход случился: вторая копия меню (шапка или нижняя панель) перечитывает куку.
  useEffect(() => {
    if (state.signedOutAt) window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }, [state.signedOutAt]);

  useDismissableDetails(menu);

  if (!user) return children;

  const label = user.name ?? user.email;
  const bar = variant === "bar";

  return (
    <details ref={menu} className={`relative ${bar ? "flex flex-1" : ""}`}>
      <summary
        className={
          bar
            ? `${itemClassName} cursor-pointer list-none [&::-webkit-details-marker]:hidden`
            : "flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-sm px-1.5 text-sm font-medium text-text-2 hover:text-text [&::-webkit-details-marker]:hidden"
        }
      >
        <span className={bar ? "inline-flex h-7 w-12 items-center justify-center" : ""}>
          <Avatar user={user} />
        </span>
        <span className={bar ? "text-xs font-medium" : "max-w-40 truncate"}>{bar ? "Профиль" : label}</span>
        <span className="sr-only">: меню аккаунта</span>
      </summary>

      <div
        className={`glass-modal absolute right-0 z-30 w-64 rounded-md border border-fill-2 p-1.5 ${bar ? "bottom-full mb-3" : "top-full mt-2"}`}
      >
        <div className="border-b border-line px-3 pt-2 pb-3">
          <p className="truncate text-base font-medium">{label}</p>
          <p className="truncate text-xs text-dim">{user.email}</p>
        </div>
        <Link
          href="/profile"
          className="mt-1.5 flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-sm text-text-2 hover:bg-fill hover:text-text"
        >
          <UserRound aria-hidden="true" className="size-4" />
          Профиль
        </Link>
        {/* Форма с server action: без JS это обычная отправка формы. */}
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 text-sm text-text-2 hover:bg-fill hover:text-text disabled:cursor-default disabled:text-dim"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {pending ? "Выходим…" : "Выйти"}
          </button>
        </form>
      </div>
    </details>
  );
}

/** Аватар Google или инициал. Круг — единственное место, где radius-full разрешён (docs/04). */
function Avatar({ user }: { user: DisplayUser }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 28px аватар с googleusercontent: оптимизатор и remotePatterns ради него не нужны
      <img
        src={user.avatarUrl}
        alt=""
        width={28}
        height={28}
        referrerPolicy="no-referrer"
        className="size-7 shrink-0 rounded-full border border-line object-cover"
      />
    );
  }
  const initial = (user.name ?? user.email).trim().charAt(0).toLocaleUpperCase("ru");
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-fill-2 text-sm font-semibold"
    >
      {initial}
    </span>
  );
}
