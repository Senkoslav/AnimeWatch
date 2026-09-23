/**
 * Перевод ответа Shikimori в наши модели. Здесь нет сети и нет базы: чистая функция,
 * которую можно проверить на зафиксированном ответе API (tests/fixtures/shikimori-animes.json).
 */
import { moscowWeekday } from "@/lib/format";
import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";

import type { AnimeNode } from "./schema";

/** Их типы, которые попадают в каталог. Музыкальные клипы, промо и рекламу не берём. */
const KINDS: Record<string, TitleKind> = {
  tv: TitleKind.TV,
  movie: TitleKind.MOVIE,
  ova: TitleKind.OVA,
  ona: TitleKind.ONA,
  special: TitleKind.SPECIAL,
  tv_special: TitleKind.SPECIAL,
};

/** HIDDEN импорт не ставит никогда: это рубильник по жалобе правообладателя, а не состояние выхода. */
const STATUSES: Record<string, TitleStatus> = {
  anons: TitleStatus.ANNOUNCED,
  ongoing: TitleStatus.ONGOING,
  released: TitleStatus.COMPLETED,
};

/** Теги разметки Shikimori: `[character=1]имя[/character]`, `[anime=2]…[/anime]`, `[b]…[/b]`. */
const MARKUP_TAG = /\[\/?[a-z_]+(?:=[^\]]*)?\]/g;

/**
 * Текст описания без их разметки. Японские имена в квадратных скобках — «[エレン・イェーガー]» —
 * это содержание, а не теги: их оставляем, иначе из описания пропадут куски текста.
 */
export function cleanDescription(source: string | null | undefined): string | null {
  if (!source) return null;
  const text = source
    .replace(/\[br\]/gi, "\n")
    .replace(MARKUP_TAG, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/**
 * Сколько серий заводить. У завершённых тайтлов число лежит в `episodes`, а `episodesAired` = 0
 * (проверено на «Стальном алхимике»: 64/0). У онгоингов наоборот: «Ван-Пис» — 0/1178.
 * Поэтому у выходящего тайтла считаем по вышедшим, у остальных — по заявленным.
 */
export function episodeCount(node: Pick<AnimeNode, "status" | "episodes" | "episodesAired">): number {
  const announced = node.episodes ?? 0;
  const aired = node.episodesAired ?? 0;
  if (node.status === "ongoing") return aired;
  return announced || aired;
}

export interface MappedTitle {
  shikimoriId: number;
  name: string;
  nameRu: string;
  synonyms: string[];
  description: string | null;
  posterUrl: string | null;
  kind: TitleKind;
  status: TitleStatus;
  year: number | null;
  season: string | null;
  ageRating: string | null;
  genres: string[];
  /** Оценка Shikimori, 0–10. null — никто не оценил: их 0.0 сюда не доходит. */
  score: number | null;
  totalEpisodes: number | null;
  /** Длительность серии в секундах: у них минуты, у нас `Episode.duration` в секундах. */
  episodeSeconds: number | null;
  episodeCount: number;
  /** Следующая серия и её день недели по Москве; только у онгоингов, у остальных — null. */
  nextEpisodeAt: Date | null;
  airDay: number | null;
}

/** null — тайтл в каталог не берём: неизвестный тип (клип, реклама) или неизвестный статус. */
export function mapTitle(node: AnimeNode): MappedTitle | null {
  const kind = node.kind ? KINDS[node.kind] : undefined;
  const status = node.status ? STATUSES[node.status] : undefined;
  if (!kind || !status) return null;

  const synonyms = [node.english, node.japanese, ...(node.synonyms ?? [])]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());

  return {
    shikimoriId: node.id,
    name: node.name.trim(),
    // Русского названия может не быть: тогда в каталоге показываем оригинальное, а не пустоту.
    nameRu: node.russian?.trim() || node.name.trim(),
    synonyms: [...new Set(synonyms)],
    description: cleanDescription(node.description),
    posterUrl: node.poster?.originalUrl ?? null,
    kind,
    status,
    year: node.airedOn?.year ?? null,
    season: node.season ?? null,
    ageRating: node.rating?.trim() || null,
    // Их 0.0 значит «никто не оценил». Оставить нулём — значит поставить анонсы ниже провальных тайтлов
    // в сортировке по рейтингу и нарисовать на карточке бейдж «0».
    score: node.score ? node.score : null,
    genres: (node.genres ?? []).map((genre) => genre.russian),
    totalEpisodes: node.episodes || null,
    episodeSeconds: node.duration ? node.duration * 60 : null,
    episodeCount: episodeCount(node),
    ...schedule(node, status),
  };
}

/**
 * Расписание — только у того, что выходит. У завершённого их API может ещё держать старую дату, и без
 * этой проверки повторный импорт оставил бы вышедший тайтл в расписании навсегда.
 */
function schedule(node: AnimeNode, status: TitleStatus): { nextEpisodeAt: Date | null; airDay: number | null } {
  if (status !== TitleStatus.ONGOING || !node.nextEpisodeAt) return { nextEpisodeAt: null, airDay: null };
  const nextEpisodeAt = new Date(node.nextEpisodeAt);
  return { nextEpisodeAt, airDay: moscowWeekday(nextEpisodeAt) };
}
