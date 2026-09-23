"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { clientIp } from "@/lib/client-ip";
import type { TitleKind } from "@/lib/generated/prisma/enums";
import { searchTitles } from "@/lib/queries/search";
import { hitRateLimit } from "@/lib/rate-limit";

// Константы — не отсюда: файл "use server" может экспортировать только async-функции.
import { MIN_QUICK_QUERY, normalizeQuery } from "./query";

/** Строк в окне поиска: остальное — по ссылке «Все результаты» на /search. */
const QUICK_LIMIT = 8;
/**
 * Лимит на адрес: живой поиск шлёт запрос на каждую паузу в наборе, и каждый запрос — полный скан
 * `Title` (docs/03, «Поиск на объёме»). Человек за минуту столько не наберёт, перебор — наберёт.
 */
const RULE = { limit: 60, windowSeconds: 60 };

export interface QuickTitle {
  slug: string;
  nameRu: string;
  posterUrl: string | null;
  kind: TitleKind;
  year: number | null;
}

export type QuickSearchResult =
  | { ok: true; query: string; titles: QuickTitle[]; more: boolean }
  | { ok: false; query: string; error: "limited" | "failed" };

const inputSchema = z.string().max(500).catch("");

/**
 * Живой поиск для окна (components/search/search-dialog.tsx). Публичное чтение: сессию не
 * проверяет — искать может и аноним, — но проходит zod и лимит по хешу адреса, как форма /dmca.
 * Тот же запрос `pg_trgm`, что у /search: одна фраза не должна находить разное в окне и на странице.
 */
export async function quickSearch(raw: unknown): Promise<QuickSearchResult> {
  const query = normalizeQuery(inputSchema.parse(raw));
  if (query.length < MIN_QUICK_QUERY) return { ok: true, query, titles: [], more: false };

  const { limited } = await hitRateLimit("search", clientIp(await headers()), RULE);
  if (limited) return { ok: false, query, error: "limited" };

  try {
    const { titles, truncated } = await searchTitles(query);
    return {
      ok: true,
      query,
      titles: titles.slice(0, QUICK_LIMIT).map(({ slug, nameRu, posterUrl, kind, year }) => ({
        slug,
        nameRu,
        posterUrl,
        kind,
        year,
      })),
      more: titles.length > QUICK_LIMIT || truncated,
    };
  } catch (error) {
    console.error("[search] живой поиск не удался:", error instanceof Error ? error.message : error);
    return { ok: false, query, error: "failed" };
  }
}
