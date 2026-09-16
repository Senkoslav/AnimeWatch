/** Метка «новая» — единственный янтарь на главной: серия вышла меньше суток назад. */
export function FreshMark() {
  return (
    <span className="inline-flex items-center rounded-sm border border-signal px-1.5 text-xs font-medium text-signal">
      новая
    </span>
  );
}
