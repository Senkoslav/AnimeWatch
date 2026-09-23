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

/** Длительность серии: 24:05, 1:45:02. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/**
 * Оценка Shikimori одним знаком после запятой: 8.49 → «8.5», 9 → «9.0».
 * Их сырое число показывать нельзя — рядом на карточке оно читается как случайные цифры.
 */
export function formatScore(score: number): string {
  return score.toFixed(1).replace(".", ",");
}

/** Номер серии как номер дубля: 07, 12, 108. */
export function formatEpisodeNumber(number: number): string {
  return String(number).padStart(2, "0");
}

const SEASONS: Record<string, string> = { winter: "Зима", spring: "Весна", summer: "Лето", fall: "Осень" };

/**
 * Сезон Shikimori: «spring_2022» → «Весна 2022», «fall» → «Осень». Незнакомое значение — null, а не
 * сырая строка: «ongoing_2024» в таблице фактов читалось бы как поломка.
 */
export function formatSeason(season: string | null): string | null {
  if (!season) return null;
  const [name = "", year] = season.split("_");
  const label = SEASONS[name];
  if (!label) return null;
  return year && /^\d{4}$/.test(year) ? `${label} ${year}` : label;
}

const AGE_RATINGS: Record<string, string> = {
  g: "G, для всех",
  pg: "PG, для детей",
  pg_13: "PG-13, с 13 лет",
  r: "R-17, с 17 лет",
  r_plus: "R+, с 17 лет",
  rx: "Rx, 18+",
};

/** Возрастной рейтинг Shikimori по-человечески: «pg_13» → «PG-13, с 13 лет». «none» и мусор — null. */
export function formatAgeRating(rating: string | null): string | null {
  return rating ? (AGE_RATINGS[rating] ?? null) : null;
}

/** День выхода по airDay (1 — понедельник): «по четвергам». Вне 1–7 — null. */
const AIR_DAYS = ["по понедельникам", "по вторникам", "по средам", "по четвергам", "по пятницам", "по субботам", "по воскресеньям"];

export function formatAirDay(airDay: number | null): string | null {
  return airDay && airDay >= 1 && airDay <= 7 ? (AIR_DAYS[airDay - 1] ?? null) : null;
}

/** Вышла в тот же календарный день по Москве: «Вышло сегодня» — про календарь, а не про последние сутки. */
export function isToday(date: Date, now: Date): boolean {
  return calendarDaysBetween(date, now) === 0;
}

const weekdayInMoscow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIME_ZONE });
const WEEKDAY_NUMBER: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** День недели по Москве в той же нумерации, что airDay у Shikimori: 1 — понедельник, 7 — воскресенье. */
export function moscowWeekday(now: Date): number {
  return WEEKDAY_NUMBER[weekdayInMoscow.format(now)] ?? 1;
}

/** Короткое имя дня для чипов расписания: «пн», «вт». */
export const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

const timeInMoscow = new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

/** Время выхода по Москве: «17:15». День и время у сериала повторяются каждую неделю, дата — нет. */
export function formatAirTime(date: Date): string {
  return timeInMoscow.format(date);
}

/** Полное имя дня для заголовков недели: «Понедельник». */
export const WEEKDAY_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"] as const;
