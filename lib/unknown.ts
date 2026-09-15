/**
 * Сужение unknown из внешних JSON — вывода ffprobe, выгрузки Telegram, ответов API.
 * Типам таких данных не доверяем: каждое поле проверяется при чтении.
 */
export type Json = Record<string, unknown>;

export function asObject(value: unknown): Json | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : undefined;
}

/** Пустая строка тоже считается отсутствующим значением. */
export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Число или строка с числом: ffprobe и Telegram отдают числа по-разному. */
export function asNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
