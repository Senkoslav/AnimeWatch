/**
 * Метка «новая»: серия вышла меньше суток назад. Янтарь по закону мира — это ровно то, что
 * происходит сейчас. Точка слева повторяет смысл формой: одного цвета для признака мало.
 *
 * Поверх постера метке нужна тёмная основа: постеры заранее неизвестны, и янтарь на светлом
 * кадре не проходит по контрасту. Материал при этом стеклянный — под меткой реально есть
 * картинка (docs/04, «Стекло»).
 */
export function FreshMark({ onPoster = false }: { onPoster?: boolean }) {
  const surface = onPoster
    ? "glass-panel absolute top-2 right-2 border-signal-line bg-bg/65"
    : "border-signal-line bg-signal-soft";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-semibold text-signal ${surface}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />
      новая
    </span>
  );
}
