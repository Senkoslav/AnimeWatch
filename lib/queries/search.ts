import { prisma } from "@/lib/db";
import { publicTitleWhere } from "@/lib/public-where";

import type { CatalogItem } from "./catalog";

export const SEARCH_LIMIT = 24;

/**
 * Нижняя граница похожести. Одна перестановка букв в слове ломает две триграммы: «фиррен» против
 * «Фрирен» даёт всего 0.29 (мерил на реальном pg_trgm), поэтому граница низкая.
 */
const FLOOR_SCORE = 0.2;

/**
 * Доля от лучшего совпадения: всё, что заметно хуже лидера, — шум. Так порог подстраивается сам.
 * Точный запрос даёт лидера 1.0 и отсекает случайные 0.2; опечатка даёт 0.29 и держится у границы.
 */
const RELATIVE_SCORE = 0.6;

/**
 * Короче этого подстрока не ищется: по «а» она совпадает почти с каждым названием и возвращает
 * весь каталог, считая при этом триграммы по всем строкам. Триграммный счёт для таких запросов остаётся.
 */
const MIN_SUBSTRING_LENGTH = 3;

/**
 * Сколько совпадений отбирает каталог. Больше, чем показывает /search: там это готовая выдача,
 * а в каталоге поверх ещё лягут жанр, год и страницы, и слишком короткий список опустеет от фильтра.
 */
export const CATALOG_MATCH_LIMIT = 200;

export type SearchResult = {
  titles: CatalogItem[];
  /** Совпадений больше, чем показано: выдача обрезана по SEARCH_LIMIT. */
  truncated: boolean;
};

const EMPTY: SearchResult = { titles: [], truncated: false };

export interface RankedIds {
  /** Ровно `limit` штук или меньше, по убыванию счёта. */
  ids: string[];
  /** Совпадений было больше лимита: вызывающий обязан сказать об этом, а не молча обрезать. */
  truncated: boolean;
}

/**
 * Идентификаторы совпадений по убыванию счёта. Вынесено из searchTitles, чтобы каталог искал тем же
 * запросом, а не завёл второй: разойдясь, они дали бы разную выдачу на одно и то же слово.
 */
export async function rankTitleIds(query: string, limit: number): Promise<RankedIds> {
  if (!query) return { ids: [], truncated: false };

  const like = `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const substringEnabled = query.length >= MIN_SUBSTRING_LENGTH;
  // На один больше лимита: лишняя строка говорит, что выдача обрезана, и не требует отдельного COUNT.
  const ranked = await prisma.$queryRaw<{ id: string }[]>`
    WITH scored AS (
      SELECT
        t.id,
        t."nameRu" AS name_ru,
        (
          ${substringEnabled}::boolean
          AND (
            t."nameRu" ILIKE ${like}
            OR t."name" ILIKE ${like}
            OR array_to_string(t."synonyms", ' ') ILIKE ${like}
          )
        ) AS substring_hit,
        GREATEST(
          similarity(t."nameRu", ${query}),
          word_similarity(${query}, t."nameRu"),
          similarity(t."name", ${query}),
          word_similarity(${query}, t."name"),
          similarity(array_to_string(t."synonyms", ' '), ${query}),
          word_similarity(${query}, array_to_string(t."synonyms", ' '))
        ) AS score
      FROM "Title" t
      -- Те же условия, что в publicTitleWhere(): непубличный тайтл иначе занял бы место в лимите
      -- и своим счётом задрал относительный порог. Расхождение двух мест ловит tests/db/search.test.ts.
      WHERE t."publishedAt" IS NOT NULL
        AND t."status" <> 'HIDDEN'
    ),
    candidates AS (
      SELECT *, MAX(score) OVER () AS best FROM scored
      WHERE substring_hit OR score >= ${FLOOR_SCORE}
    )
    SELECT id FROM candidates
    WHERE substring_hit OR score >= GREATEST(${FLOOR_SCORE}, best * ${RELATIVE_SCORE})
    ORDER BY score DESC, name_ru ASC
    LIMIT ${limit + 1}::int
  `;
  // Лишняя строка — только сигнал обрезки, наружу она не уходит: иначе вызывающий тихо получил бы limit + 1.
  return { ids: ranked.slice(0, limit).map((row) => row.id), truncated: ranked.length > limit };
}

export async function searchTitles(query: string): Promise<SearchResult> {
  const { ids, truncated } = await rankTitleIds(query, SEARCH_LIMIT);
  if (ids.length === 0) return EMPTY;

  const found = await prisma.title.findMany({
    where: { AND: [publicTitleWhere(), { id: { in: ids } }] },
    select: { id: true, slug: true, nameRu: true, posterUrl: true, kind: true, year: true, score: true, status: true },
  });

  // Порядок задаёт счёт из SQL, findMany его не сохраняет.
  const byId = new Map(found.map((title) => [title.id, title]));
  return {
    titles: ids.flatMap((id) => {
      const title = byId.get(id);
      return title ? [title] : [];
    }),
    truncated,
  };
}
