"use client";

import { usePathname } from "next/navigation";
import { type RefObject, useEffect } from "react";

/**
 * Выпадающее меню на `<details>` закрывается как любое меню: при переходе, по Esc и нажатием мимо.
 * Сам `<details>` так не умеет, а своё состояние открытости ему заводить незачем.
 */
export function useDismissableDetails(ref: RefObject<HTMLDetailsElement | null>) {
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname, ref]);

  useEffect(() => {
    function close(event: Event) {
      const details = ref.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !details.contains(event.target as Node)) {
        details.open = false;
        // Esc возвращает фокус на кнопку меню, как у нативных меню.
        if (event instanceof KeyboardEvent) details.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [ref]);
}
