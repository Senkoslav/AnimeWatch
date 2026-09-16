/**
 * Скорости воспроизведения. Встроенный набор Video.js (0.2, 0.7, 1.2, 1.7…) непривычен и не настраивается,
 * поэтому меню скорости собрано на своём списке.
 */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const rateFormat = new Intl.NumberFormat("ru", { maximumFractionDigits: 2 });

/** «0,75×», «1×». */
export function formatRate(rate: number): string {
  return `${rateFormat.format(rate)}×`;
}

export function isKnownRate(rate: unknown): rate is (typeof PLAYBACK_RATES)[number] {
  return typeof rate === "number" && (PLAYBACK_RATES as readonly number[]).includes(rate);
}
