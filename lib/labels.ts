/** Подписи значений из базы для интерфейса. */
import { TitleKind, TitleStatus, WatchState } from "@/lib/generated/prisma/enums";

import type { CatalogSort, PublicStatus } from "./catalog/params";

export const KIND_LABELS: Record<TitleKind, string> = {
  [TitleKind.TV]: "ТВ-сериал",
  [TitleKind.MOVIE]: "Фильм",
  [TitleKind.OVA]: "OVA",
  [TitleKind.ONA]: "ONA",
  [TitleKind.SPECIAL]: "Спешл",
};

export const STATUS_LABELS: Record<PublicStatus, string> = {
  [TitleStatus.ONGOING]: "Выходит",
  [TitleStatus.COMPLETED]: "Завершён",
  [TitleStatus.ANNOUNCED]: "Анонс",
};

export const SORT_LABELS: Record<CatalogSort, string> = {
  new: "Сначала новые",
  popular: "По популярности",
  score: "По рейтингу",
  year: "По году",
  name: "По названию",
};

/** Списки (docs/04, «Диаграммы» — тот же порядок): что стоит на кнопке «В список» у вошедшего. */
export const WATCH_STATE_LABELS: Record<WatchState, string> = {
  [WatchState.WATCHING]: "Смотрю",
  [WatchState.PLANNED]: "Запланировано",
  [WatchState.COMPLETED]: "Просмотрено",
  [WatchState.DROPPED]: "Брошено",
};

/** Порядок пунктов в меню списков и в профиле. */
export const WATCH_STATES = [WatchState.WATCHING, WatchState.PLANNED, WatchState.COMPLETED, WatchState.DROPPED] as const;
