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
// en-CA даёт ГГГГ-ММ-ДД: из неё берётся календарная дата по Москве.
const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/** Сколько календарных дней по Москве между датами: 23:00 субботы и 05:00 понедельника — два дня, не один. */
function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((Date.parse(isoDate.format(to)) - Date.parse(isoDate.format(from))) / DAY);
}

/** «только что», «5 минут назад», «2 часа назад»; дальше по календарю: «вчера», «3 дня назад», затем дата. */
export function formatRelativeDate(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "только что";
  if (diff < HOUR) return relative.format(-Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), "hour");
  const days = calendarDaysBetween(date, now);
  if (days < 7) return relative.format(-days, "day");
  return yearOnly.format(date) === yearOnly.format(now) ? dayMonth.format(date) : dayMonthYear.format(date);
}

/** Вышла меньше суток назад: единственное на главной, что «происходит сейчас» и получает акцент. */
export function isFresh(date: Date, now: Date): boolean {
  return now.getTime() - date.getTime() < DAY;
}

const pluralRules = new Intl.PluralRules("ru");

/** Формы слова для 1, 2 и 5: ["тайтл", "тайтла", "тайтлов"]. */
export type PluralForms = readonly [one: string, few: string, many: string];

/** «1 тайтл», «3 тайтла», «8 тайтлов». */
export function formatCount(count: number, [one, few, many]: PluralForms): string {
  const rule = pluralRules.select(count);
  const word = rule === "one" ? one : rule === "few" ? few : many;
  return `${count} ${word}`;
}

/** Номер серии как номер дубля: 07, 12, 108. */
export function formatEpisodeNumber(number: number): string {
  return String(number).padStart(2, "0");
}
