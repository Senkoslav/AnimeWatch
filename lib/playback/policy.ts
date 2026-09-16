/** Правила выдачи видео без базы и секретов: чистые функции, их проверяют юнит-тесты. */
import { SourceType } from "@/lib/generated/prisma/enums";

/** Запас сверх длительности серии: перемотки, пауза на чай, медленная сеть. */
export const TOKEN_MARGIN_SECONDS = 2 * 60 * 60;
/** Длительность ещё не известна (Bunny не прислал вебхук): берём с запасом на полнометражный фильм. */
export const UNKNOWN_DURATION_TTL_SECONDS = 4 * 60 * 60;

/**
 * Сколько живёт подписанный URL. Срок покрывает серию с запасом (docs/02, «Безопасность»); долгую паузу
 * он не покрывает, это закрывает перевыпуск URL в плеере по 403.
 */
export function playbackTtlSeconds(durationSeconds: number | null): number {
  return durationSeconds && durationSeconds > 0
    ? Math.ceil(durationSeconds) + TOKEN_MARGIN_SECONDS
    : UNKNOWN_DURATION_TTL_SECONDS;
}

export interface SourceCandidate {
  type: SourceType;
  url: string;
  isDefault: boolean;
  priority: number;
}

/** Источник для плеера: сначала isDefault, затем меньший priority (docs/03, модель Source). Играем только HLS. */
export function pickSource<T extends SourceCandidate>(sources: readonly T[]): T | undefined {
  return sources
    .filter((source) => source.type === SourceType.HLS && source.url !== "")
    .toSorted((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.priority - b.priority)[0];
}
