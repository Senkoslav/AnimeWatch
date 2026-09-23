"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Мобильное меню на нативном <details>: раскрытие, клавиатура и кольцо фокуса достаются от браузера,
 * и без JS оно работает целиком.
 *
 * Клиентский лист нужен ровно для одного: закрыть меню после перехода. Шапка живёт в рутовом
 * лэйауте и при клиентской навигации не перемонтируется, а атрибут `open` ставит сам браузер —
 * React его не сбрасывает, и меню осталось бы раскрытым поверх новой страницы. Приём с `key`,
 * которым спасается панель фильтров, здесь не работает по той же причине.
 *
 * Без JS этот эффект не выполняется, но и не нужен: там каждый переход — полная перезагрузка,
 * после которой <details> и так закрыт.
 */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);

  return (
    <details ref={details} className="lg:hidden">
      {/* list-none и скрытый маркер: треугольник от <summary> в шапке не нужен. */}
      <summary className="-ml-2 inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-sm text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        {/* Имя кнопке даёт текст, а не aria-label: иконка сама по себе ничего не говорит. */}
        <span className="sr-only">{label}</span>
        <Menu aria-hidden="true" className="size-5" />
      </summary>

      {/* Абсолютно — под всей шапкой: внутри строки-флексбокса панель иначе встала бы в ряд.
          Привязка к самой шапке: sticky уже делает её позиционированным предком. */}
      <div className="glass-chrome absolute top-full left-0 w-full border-b border-line">
        <div className="mx-auto max-w-page px-4 lg:px-8 py-3">{children}</div>
      </div>
    </details>
  );
}
