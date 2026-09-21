/** Номера страниц для пагинации: первая, последняя, окно вокруг текущей и пропуски между ними. */

/** Пропуск в ряду номеров. Не число, поэтому в разметке это не ссылка, а многоточие. */
export const PAGE_GAP = "gap" as const;

export type PageSlot = number | typeof PAGE_GAP;

/** Сколько соседей показываем по каждую сторону от текущей. */
const NEIGHBOURS = 1;

/**
 * Первая и последняя страницы стоят всегда: без них из середины длинной выдачи не вернуться в
 * начало и не дойти до конца одним нажатием. Пропуск ставится, только когда он заменяет больше
 * одного номера: «1 … 3» занимает столько же места, сколько «1 2 3», но требует лишнего прицела.
 */
export function pageWindow(page: number, pageCount: number): PageSlot[] {
  const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const numbers = new Set<number>([1, pageCount]);
  for (let offset = -NEIGHBOURS; offset <= NEIGHBOURS; offset += 1) {
    const number = current + offset;
    if (number >= 1 && number <= pageCount) numbers.add(number);
  }

  const slots: PageSlot[] = [];
  let previous = 0;
  for (const number of [...numbers].sort((a, b) => a - b)) {
    if (number - previous === 2) slots.push(previous + 1);
    else if (number - previous > 2) slots.push(PAGE_GAP);
    slots.push(number);
    previous = number;
  }
  return slots;
}

/** «Показано 1–24 из 348»: границы считаются по странице, а не по длине массива на экране. */
export function shownRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  const from = (page - 1) * pageSize + 1;
  return { from: Math.min(from, total), to: Math.min(page * pageSize, total) };
}
