import { WatchState } from "@/lib/generated/prisma/enums";

/**
 * Цвет списка на диаграммах (docs/04, «Диаграммы»): следует за списком, а не за его местом в
 * сортировке. Классы полные строками — иначе Tailwind их не найдёт.
 */
export const LIST_STROKE: Record<WatchState, string> = {
  [WatchState.WATCHING]: "stroke-chart-watching",
  [WatchState.PLANNED]: "stroke-chart-planned",
  [WatchState.COMPLETED]: "stroke-chart-completed",
  [WatchState.DROPPED]: "stroke-chart-dropped",
};

export const LIST_FILL: Record<WatchState, string> = {
  [WatchState.WATCHING]: "bg-chart-watching",
  [WatchState.PLANNED]: "bg-chart-planned",
  [WatchState.COMPLETED]: "bg-chart-completed",
  [WatchState.DROPPED]: "bg-chart-dropped",
};

/** Доля по-русски, с неразрывным пробелом перед знаком процента: «62 %». */
export function share(count: number, total: number): string {
  return `${total > 0 ? Math.round((count / total) * 100) : 0} %`;
}
