import type { ReactNode } from "react";

interface BandProps {
  /** Заголовок раздела. Уровень задаётся снаружи: на странице может быть и h1, и h2. */
  children: ReactNode;
  /** Правая часть полосы: счётчик, диапазон, выходные данные. */
  aside?: ReactNode;
  id?: string;
  as?: "h1" | "h2";
}

/**
 * Полоса раздела, залитая краской, — несущий элемент мира «Вкладыш».
 *
 * Краска здесь владеет целой областью, а не расставлена точками: акцент, размазанный по
 * нейтральному фону, читается как украшение, а заливка полосы — как печать. Текст на полосе
 * бумажный, а не цвета картона: на глубокой офсетной краске тёмное даёт 3.06, светлое — 5.24.
 */
export function Band({ children, aside, id, as: Tag = "h2" }: BandProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 bg-ink px-4 py-2 text-text">
      <Tag id={id} className="font-display text-sm font-bold tracking-tight">
        {children}
      </Tag>
      {aside && <span className="shrink-0 text-xs font-medium tabular-nums">{aside}</span>}
    </div>
  );
}
