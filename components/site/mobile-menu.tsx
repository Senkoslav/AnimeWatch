"use client";

import { Menu } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { useDismissableDetails } from "@/components/ui/use-dismissable-details";

/**
 * Мобильное меню на нативном <details>: раскрытие, клавиатура и кольцо фокуса достаются от браузера,
 * и без JS оно работает целиком.
 *
 * Клиентский лист нужен, чтобы закрыть меню после перехода, по Esc и нажатием мимо. Шапка живёт
 * в рутовом лэйауте и при клиентской навигации не перемонтируется, а атрибут `open` ставит сам
 * браузер — React его не сбрасывает, и меню осталось бы раскрытым поверх новой страницы.
 *
 * Без JS этот эффект не выполняется, но и не нужен: там каждый переход — полная перезагрузка,
 * после которой <details> и так закрыт.
 */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(details);

  return (
    <details ref={details} className="lg:hidden">
      {/* list-none и скрытый маркер: треугольник от <summary> в шапке не нужен. */}
      <summary className="-ml-2 inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-sm text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        {/* Имя кнопке даёт текст, а не aria-label: иконка сама по себе ничего не говорит. */}
        <span className="sr-only">{label}</span>
        <Menu aria-hidden="true" className="size-5" />
      </summary>

      {/*
        Абсолютно — под всей шапкой: внутри строки-флексбокса панель иначе встала бы в ряд.
        Привязка к самой шапке: sticky уже делает её позиционированным предком.

        Плотная поверхность, а не стекло: панель вложена в шапку со своим backdrop-filter, а
        вложенный элемент видит только фон родителя, не страницу. От стекла оставалась одна
        прозрачность без размытия, и заголовок страницы читался сквозь пункты меню.
      */}
      <div className="absolute top-full left-0 w-full border-b border-line bg-surface">
        <div className="mx-auto max-w-page px-4 lg:px-8 py-3">{children}</div>
      </div>
    </details>
  );
}
