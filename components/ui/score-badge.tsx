import { formatScore } from "@/lib/format";

/**
 * Оценка Shikimori поверх постера.
 *
 * Единственное законное стекло на карточке: под значком реально лежит картинка, и он её размывает
 * (docs/04, «Стекло»). Материал — второй уровень, но на тёмной основе: белая плёнка в 5.5%
 * над ярким постером не даёт тексту никакого контраста, а постеры у нас заранее неизвестны.
 *
 * Оценка янтарная, потому что это оценка: по закону мира сигнал помечает в том числе её.
 */
export function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="glass-panel pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-sm border border-line bg-bg/65 px-2 py-1 text-xs font-semibold text-signal">
      <span className="sr-only">Оценка Shikimori </span>
      <span data-numeric="">{formatScore(score)}</span>
    </span>
  );
}
