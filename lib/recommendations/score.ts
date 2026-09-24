/**
 * Рекомендации (docs/06, решение владельца 2026-09-24). Чистая функция: на входе каталог, отметки
 * пользователя и его «не интересно», на выходе советы с объяснением. Ни базы, ни сети — поэтому
 * каждое правило проверяется unit-тестом (score.test.ts).
 *
 * Сигналы и их доли в счёте кандидата:
 * - вкус к жанрам (40 %): жанры тайтлов в списках с весом отметки и поправкой на частоту жанра;
 * - «похоже на отмеченное» (30 %): «похожие» Shikimori для тайтлов в списках;
 * - оценка Shikimori (20 %) и популярность (10 %): опора, когда личных сигналов мало;
 * - продолжение того, что смотрят или досмотрели, — сильный отдельный плюс.
 *
 * Брошенное и низкие оценки — минус: иначе сайт советовал бы то, что человек бросил.
 */
import { RelationKind, WatchState } from "@/lib/generated/prisma/enums";

export interface CatalogRelation {
  targetShikimoriId: number;
  kind: RelationKind;
  /** Место у Shikimori: у похожих 1 — самый похожий. */
  rank: number;
}

export interface CatalogEntry {
  id: string;
  shikimoriId: number | null;
  nameRu: string;
  genres: string[];
  score: number | null;
  popularityRank: number | null;
  relations: CatalogRelation[];
}

export interface Mark {
  titleId: string;
  state: WatchState;
  rating: number | null;
}

export type Reason =
  | { type: "sequel"; of: string }
  | { type: "similar"; of: string; rating: number | null; state: WatchState }
  | { type: "genres"; genres: string[] }
  | { type: "popular"; score: number | null };

export interface Recommendation {
  titleId: string;
  reason: Reason;
}

export interface RecommendResult {
  items: Recommendation[];
  /** false — холодный старт: личных сигналов мало, это популярное с высокой оценкой. */
  personal: boolean;
}

/** Вес отметки без оценки. Отложено — слабый плюс, брошено — минус. */
const STATE_WEIGHT: Record<WatchState, number> = {
  [WatchState.WATCHING]: 0.8,
  [WatchState.COMPLETED]: 0.6,
  [WatchState.PLANNED]: 0.4,
  [WatchState.ON_HOLD]: 0.2,
  [WatchState.DROPPED]: -0.8,
};

/** «Не интересно» слегка опускает жанры скрытого — но не как «брошено»: это «не сейчас», а не «плохо». */
const DISMISS_WEIGHT = -0.3;

/** Столько положительных отметок нужно, чтобы советы стали личными. Меньше — холодный старт. */
export const MIN_POSITIVE_MARKS = 3;

const SHARE = { genres: 0.4, similar: 0.3, quality: 0.2, popularity: 0.1 } as const;
const SEQUEL_BOOST = 0.5;
/** Штраф за совпадение жанров с уже выбранными: без него десять драм подряд. */
const DIVERSITY_PENALTY = 0.15;
/** Похожие дальше этого места у Shikimori не приносят вклада (импорт хранит 20). */
const SIMILAR_DEPTH = 20;

/**
 * Вес отметки: оценка решает, если она есть — от −1 за «1» до +1 за «10», — иначе список.
 * Оценка 3 у досмотренного — это минус, как бы тайтл ни назывался в списке.
 */
export function markWeight({ state, rating }: Pick<Mark, "state" | "rating">): number {
  return rating === null ? STATE_WEIGHT[state] : (rating - 5.5) / 4.5;
}

/** Оценка Shikimori в долю: 6 и ниже — ноль, 9.5 и выше — единица. Без оценки — слабая опора. */
function quality(score: number | null): number {
  if (score === null) return 0.2;
  return Math.min(1, Math.max(0, (score - 6) / 3.5));
}

function jaccard(a: string[], b: Set<string>): number {
  if (a.length === 0 || b.size === 0) return 0;
  let common = 0;
  for (const item of a) if (b.has(item)) common += 1;
  return common / (a.length + b.size - common);
}

export function recommend({
  catalog,
  marks,
  dismissed,
  limit,
}: {
  catalog: CatalogEntry[];
  marks: Mark[];
  dismissed: string[];
  limit: number;
}): RecommendResult {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const byShikimori = new Map(
    catalog.flatMap((entry) => (entry.shikimoriId === null ? [] : [[entry.shikimoriId, entry] as const])),
  );
  const excluded = new Set([...marks.map((mark) => mark.titleId), ...dismissed]);

  // Популярность: место 1 — единица, дальше по логарифму. Без места — ноль.
  const maxRank = Math.max(1, ...catalog.map((entry) => entry.popularityRank ?? 0));
  const popularity = (rank: number | null) => (rank === null ? 0 : 1 - Math.log(rank) / Math.log(maxRank + 1));

  // Отметки только на тайтлах каталога: скрытый по жалобе или черновик для зрителя не существует.
  const weighted = marks.flatMap((mark) => {
    const entry = byId.get(mark.titleId);
    return entry ? [{ mark, entry, weight: markWeight(mark) }] : [];
  });
  const positive = weighted.filter(({ weight }) => weight > 0).length;
  const personal = positive >= MIN_POSITIVE_MARKS;

  const candidates = catalog.filter((entry) => !excluded.has(entry.id));

  if (!personal) {
    // Холодный старт: популярное с высокой оценкой. Честно помеченное — в интерфейсе это не «ваши» советы.
    const ranked = candidates
      .map((entry) => ({ entry, total: 0.65 * quality(entry.score) + 0.35 * popularity(entry.popularityRank) }))
      .sort((a, b) => b.total - a.total || a.entry.id.localeCompare(b.entry.id))
      .slice(0, limit);
    return {
      personal: false,
      items: ranked.map(({ entry }) => ({ titleId: entry.id, reason: { type: "popular", score: entry.score } })),
    };
  }

  // Вкус к жанрам. IDF: жанр, который есть почти у всех, мало говорит о вкусе.
  const documentFrequency = new Map<string, number>();
  for (const entry of catalog) {
    for (const genre of new Set(entry.genres)) documentFrequency.set(genre, (documentFrequency.get(genre) ?? 0) + 1);
  }
  const idf = (genre: string) => Math.log(1 + catalog.length / (documentFrequency.get(genre) ?? 1));
  const taste = new Map<string, number>();
  const addTaste = (genres: string[], weight: number) => {
    for (const genre of new Set(genres)) taste.set(genre, (taste.get(genre) ?? 0) + weight * idf(genre));
  };
  for (const { entry, weight } of weighted) addTaste(entry.genres, weight);
  for (const id of dismissed) {
    const entry = byId.get(id);
    if (entry) addTaste(entry.genres, DISMISS_WEIGHT);
  }
  const tasteScale = Math.max(1e-9, ...[...taste.values()].map(Math.abs));

  // «Похожие» и франшиза — в обе стороны: отмеченный тайтл ссылается на кандидата, или кандидат на него.
  type Signal = {
    similar: number;
    best: { value: number; of: (typeof weighted)[number] } | null;
    sequelOf: string | null;
  };
  const signals = new Map<string, Signal>();
  const signal = (id: string): Signal => {
    let value = signals.get(id);
    if (!value) {
      value = { similar: 0, best: null, sequelOf: null };
      signals.set(id, value);
    }
    return value;
  };
  const closeness = (rank: number) => Math.max(0, 1 - (rank - 1) / SIMILAR_DEPTH);

  for (const marked of weighted) {
    const { entry, weight, mark } = marked;
    const linkTo = (candidate: CatalogEntry | undefined, relation: CatalogRelation, direction: "out" | "in") => {
      if (!candidate || excluded.has(candidate.id)) return;
      if (relation.kind === RelationKind.SIMILAR) {
        const contribution = weight * closeness(relation.rank);
        const target = signal(candidate.id);
        target.similar += contribution;
        if (contribution > 0 && (!target.best || contribution > target.best.value)) {
          target.best = { value: contribution, of: marked };
        }
        return;
      }
      // Продолжение: у отмеченного связь SEQUEL на кандидата, или у кандидата PREQUEL на отмеченный.
      const isSequel =
        (direction === "out" && relation.kind === RelationKind.SEQUEL) ||
        (direction === "in" && relation.kind === RelationKind.PREQUEL);
      const engaged = mark.state === WatchState.WATCHING || mark.state === WatchState.COMPLETED;
      if (isSequel && engaged && weight > 0) signal(candidate.id).sequelOf = entry.nameRu;
    };

    for (const relation of entry.relations) linkTo(byShikimori.get(relation.targetShikimoriId), relation, "out");
    if (entry.shikimoriId !== null) {
      for (const candidate of candidates) {
        for (const relation of candidate.relations) {
          if (relation.targetShikimoriId === entry.shikimoriId) linkTo(candidate, relation, "in");
        }
      }
    }
  }

  const scored = candidates.map((entry) => {
    const genres = [...new Set(entry.genres)];
    const genreScore =
      genres.length === 0
        ? 0
        : genres.reduce((sum, genre) => sum + (taste.get(genre) ?? 0), 0) / tasteScale / Math.sqrt(genres.length);
    const extra = signals.get(entry.id);
    const similar = Math.max(-1, Math.min(1, extra?.similar ?? 0));
    const total =
      SHARE.genres * Math.max(-1, Math.min(1, genreScore)) +
      SHARE.similar * similar +
      SHARE.quality * quality(entry.score) +
      SHARE.popularity * popularity(entry.popularityRank) +
      (extra?.sequelOf ? SEQUEL_BOOST : 0);
    return { entry, total, extra };
  });

  // Разнообразие: жадный отбор из лучших с штрафом за жанры, похожие на уже выбранные.
  const pool = scored.sort((a, b) => b.total - a.total || a.entry.id.localeCompare(b.entry.id)).slice(0, limit * 4);
  const picked: typeof pool = [];
  const pickedGenres = new Set<string>();
  while (picked.length < limit && pool.length > 0) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (const [index, item] of pool.entries()) {
      const value = item.total - DIVERSITY_PENALTY * jaccard(item.entry.genres, pickedGenres);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }
    const [item] = pool.splice(bestIndex, 1);
    if (!item) break;
    picked.push(item);
    for (const genre of item.entry.genres) pickedGenres.add(genre);
  }

  return {
    personal: true,
    items: picked.map(({ entry, extra }) => ({ titleId: entry.id, reason: explain(entry, extra, taste) })),
  };
}

/** Главный вклад — словами: продолжение, похожее на отмеченное, любимые жанры или оценка Shikimori. */
function explain(
  entry: CatalogEntry,
  extra: { best: { of: { entry: CatalogEntry; mark: Mark } } | null; sequelOf: string | null } | undefined,
  taste: Map<string, number>,
): Reason {
  if (extra?.sequelOf) return { type: "sequel", of: extra.sequelOf };
  if (extra?.best) {
    const { entry: source, mark } = extra.best.of;
    return { type: "similar", of: source.nameRu, rating: mark.rating, state: mark.state };
  }
  const liked = [...new Set(entry.genres)]
    .filter((genre) => (taste.get(genre) ?? 0) > 0)
    .sort((a, b) => (taste.get(b) ?? 0) - (taste.get(a) ?? 0))
    .slice(0, 2);
  if (liked.length > 0) return { type: "genres", genres: liked };
  return { type: "popular", score: entry.score };
}
