/** Правила памяти позиции без DOM: их проверяют юнит-тесты, а хуки плеера только вызывают. */

/** Меньше этого с начала серии — начинаем сначала: зритель толком не смотрел. */
export const RESUME_MIN_SECONDS = 5;
/** Ближе этого к концу — серия досмотрена (финальные титры), продолжать не с чего. */
export const RESUME_END_GAP_SECONDS = 30;
/** У коротких видео (трейлер, тестовый ролик) пороги не больше этой доли длительности, иначе они съедят всё видео. */
const SHORT_VIDEO_SHARE = 0.1;

/** С какой секунды продолжить, или null — начать сначала. */
export function resumeFrom(saved: number | null, duration: number): number | null {
  if (saved === null || !Number.isFinite(saved) || !Number.isFinite(duration) || duration <= 0) return null;
  const minStart = Math.min(RESUME_MIN_SECONDS, duration * SHORT_VIDEO_SHARE);
  const endGap = Math.min(RESUME_END_GAP_SECONDS, duration * SHORT_VIDEO_SHARE);
  if (saved < minStart || saved > duration - endGap) return null;
  return saved;
}

/** Ключи sessionStorage: позиция анонима живёт во вкладке (docs/03), флаг автостарта — до следующей страницы. */
export const positionKey = (episodeId: string) => `bebradub:position:${episodeId}`;
export const AUTOPLAY_KEY = "bebradub:autoplay";
/** localStorage: настройки устройства (docs/05, «Воспроизведение»). */
export const PREFERENCES_KEY = "bebradub:player";

export function readNumber(storage: Storage | undefined, key: string): number | null {
  try {
    const value = Number(storage?.getItem(key));
    return storage?.getItem(key) !== null && Number.isFinite(value) ? value : null;
  } catch {
    // Хранилище недоступно (приватный режим, запрет cookies): память позиции просто не работает.
    return null;
  }
}
