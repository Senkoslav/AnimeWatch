import type { WatchState } from "@/lib/generated/prisma/enums";
import { WATCH_STATE_LABELS } from "@/lib/labels";

/**
 * Свой список на постере карточки (решение владельца 2026-09-23: в карточке отметка только
 * показывается, ставится на странице тайтла). Стекло второго уровня на тёмной основе, как значок
 * оценки: постер под ним заранее неизвестен (docs/04, «Стекло»).
 */
export function StateBadge({ state }: { state: WatchState }) {
  return (
    <span className="glass-panel pointer-events-none absolute top-2 right-2 rounded-sm border border-line bg-bg/65 px-2 py-0.5 text-xs font-medium text-text">
      <span className="sr-only">В вашем списке: </span>
      {WATCH_STATE_LABELS[state].toLocaleLowerCase("ru")}
    </span>
  );
}
