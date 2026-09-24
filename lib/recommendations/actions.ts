"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { clientIp } from "@/lib/client-ip";
import { dismissTitle, getRecommendations, type Recommendations, restoreTitle } from "@/lib/queries/recommendations";
import { hitRateLimit } from "@/lib/rate-limit";

export type RecommendationsResult =
  ({ ok: true } & Recommendations) | { ok: false; error: "signin" | "limited" | "failed" };

export type DismissResult = { ok: true } | { ok: false; error: "signin" | "invalid" | "unavailable" | "failed" };

const titleIdSchema = z.cuid();
const limitSchema = z.int().min(1).max(24);

/** Расчёт — полный проход по каталогу: лимит на адрес, как у живого поиска. */
const RULE = { limit: 30, windowSeconds: 60 };

/**
 * Советы для ряда на главной (ISR — о пользователе не знает, ряд подгружается в браузере). Сессия
 * первой строкой: аноним ряда не видит, ему на главной и так есть «Популярное».
 */
export async function getMyRecommendations(limit: number): Promise<RecommendationsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  const size = limitSchema.catch(6).parse(limit);

  const { limited } = await hitRateLimit("recommendations", clientIp(await headers()), RULE);
  if (limited) return { ok: false, error: "limited" };

  try {
    return { ok: true, ...(await getRecommendations(user.id, size)) };
  } catch (error) {
    console.error("[recommendations] расчёт не удался:", error instanceof Error ? error.message : error);
    return { ok: false, error: "failed" };
  }
}

async function change(action: "dismiss" | "restore", titleId: unknown): Promise<DismissResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  const parsed = titleIdSchema.safeParse(titleId);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    if (action === "restore") {
      await restoreTitle(user.id, parsed.data);
      return { ok: true };
    }
    return (await dismissTitle(user.id, parsed.data)) ? { ok: true } : { ok: false, error: "unavailable" };
  } catch (error) {
    console.error(`[recommendations] ${action} не удалось:`, error instanceof Error ? error.message : error);
    return { ok: false, error: "failed" };
  }
}

/** «Не интересно»: совет больше не показывается и слегка опускает жанры этого тайтла. */
export async function dismissRecommendation(titleId: string): Promise<DismissResult> {
  return change("dismiss", titleId);
}

/** «Вернуть» — отмена «Не интересно» сразу после нажатия. */
export async function restoreRecommendation(titleId: string): Promise<DismissResult> {
  return change("restore", titleId);
}
