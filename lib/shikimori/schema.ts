/**
 * Ответ Shikimori — внешний вход, поэтому разбирается zod (`.claude/rules/server.md`).
 * Схема нарочно снисходительна к полям, которых может не быть: отсутствие описания или постера —
 * это нормальный тайтл, а не повод уронить импорт целиком.
 */
import { z } from "zod";

/** id приходит строкой, хотя у нас `Title.shikimoriId` — число. Проверяем, а не приводим вслепую. */
const idSchema = z
  .string()
  .regex(/^\d{1,9}$/)
  .transform(Number);

export const animeNodeSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  russian: z.string().nullish(),
  english: z.string().nullish(),
  japanese: z.string().nullish(),
  synonyms: z.array(z.string()).nullish(),
  kind: z.string().nullish(),
  status: z.string().nullish(),
  season: z.string().nullish(),
  airedOn: z.object({ year: z.number().int().nullish() }).nullish(),
  // У завершённых тайтлов число серий лежит в episodes, а episodesAired = 0; у онгоингов наоборот.
  episodes: z.number().int().min(0).nullish(),
  episodesAired: z.number().int().min(0).nullish(),
  duration: z.number().int().min(0).nullish(),
  rating: z.string().nullish(),
  // 0.0 у тайтла без оценок — это «оценки нет», а не ноль. Разбирается как есть, смысл придаёт mapTitle.
  score: z.number().min(0).max(10).nullish(),
  description: z.string().nullish(),
  // Дата со смещением: «2026-09-27T17:15:00+03:00». Есть только у онгоингов; у остальных null.
  nextEpisodeAt: z.iso.datetime({ offset: true }).nullish(),
  genres: z.array(z.object({ russian: z.string() })).nullish(),
  poster: z.object({ originalUrl: z.url() }).nullish(),
  // Франшиза: продолжения, приквелы, спин-офы. anime = null — связь с мангой или ранобэ, её пропускаем.
  // null целиком — поле не пришло (старый запрос, сбой): тогда связи тайтла импорт не трогает.
  related: z
    .array(z.object({ relationKind: z.string(), anime: z.object({ id: idSchema }).nullish() }))
    .nullish(),
});

export type AnimeNode = z.output<typeof animeNodeSchema>;

/** REST «похожие»: массив тайтлов, id — число. Элемент без числового id — null, его отбросят. */
export const similarResponseSchema = z.array(
  z
    .object({ id: z.number().int().positive() })
    .nullable()
    .catch(null),
);

export const animesResponseSchema = z.object({
  data: z.object({ animes: z.array(z.unknown()) }).nullish(),
  errors: z.array(z.object({ message: z.string() })).nullish(),
});
