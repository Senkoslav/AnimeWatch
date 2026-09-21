import type { ReactNode } from "react";

interface SectionHeadingProps {
  /** Заголовок раздела. Уровень задаётся снаружи: на странице может быть и h1, и h2. */
  children: ReactNode;
  /** Правая часть строки: счётчик, диапазон, ссылка «все». */
  aside?: ReactNode;
  id?: string;
  as?: "h1" | "h2" | "h3";
  /**
   * Янтарная засечка — только у разделов про «сейчас»: новые серии, онгоинги, расписание.
   * У остальных нейтральная: сигнал, поставленный там, где ничего не происходит, перестаёт
   * что-либо означать (docs/04, «Токены»).
   */
  tone?: "signal" | "neutral";
  className?: string;
}

const TICK = { signal: "bg-signal", neutral: "bg-line" } as const;

/**
 * Заголовок раздела: засечка 3×18 и название дисплейной гарнитурой.
 *
 * Пришёл на место залитой полосы прошлого мира (`Band`). Полоса работала, пока краска владела
 * целыми областями; в «Ночном стекле» сигнал помечает точку, а не площадь, поэтому от полосы
 * остаётся только засечка — и она несёт смысл, а не украшает.
 */
export function SectionHeading({
  children,
  aside,
  id,
  as: Tag = "h2",
  tone = "neutral",
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span aria-hidden="true" className={`h-[18px] w-[3px] shrink-0 rounded-[2px] ${TICK[tone]}`} />
      <Tag id={id} className="font-display text-lg font-semibold tracking-tight">
        {children}
      </Tag>
      {aside && <span className="ml-auto shrink-0 text-sm text-dim tabular-nums">{aside}</span>}
    </div>
  );
}
