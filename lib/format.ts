/** Форматирование для интерфейса. Серверный текст: часовой пояс фиксирован, иначе на Vercel даты будут в UTC. */

const TIME_ZONE = "Europe/Moscow";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
const dayMonth = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", timeZone: TIME_ZONE });
const dayMonthYear = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const yearOnly = new Intl.DateTimeFormat("ru", { year: "numeric", timeZone: TIME_ZONE });

/** «только что», «5 минут назад», «2 часа назад», «вчера», «3 дня назад», дальше — дата. */
export function formatRelativeDate(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "только что";
  if (diff < HOUR) return relative.format(-Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), "hour");
  if (diff < 7 * DAY) return relative.format(-Math.floor(diff / DAY), "day");
  return yearOnly.format(date) === yearOnly.format(now) ? dayMonth.format(date) : dayMonthYear.format(date);
}

/** Вышла меньше суток назад: единственное на главной, что «происходит сейчас» и получает акцент. */
export function isFresh(date: Date, now: Date): boolean {
  return now.getTime() - date.getTime() < DAY;
}

/** Номер серии как номер дубля: 07, 12, 108. */
export function formatEpisodeNumber(number: number): string {
  return String(number).padStart(2, "0");
}
