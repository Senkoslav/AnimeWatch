import { describe, expect, it } from "vitest";

import {
  formatAgeRating,
  formatAirTime,
  formatAirDay,
  formatCount,
  formatDuration,
  formatEpisodeNumber,
  formatRelativeDate,
  formatScore,
  formatSeason,
  isFresh,
  isToday,
  moscowWeekday,
} from "./format";

const now = new Date("2026-09-16T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeDate", () => {
  it.each([
    [30 * 1000, "только что"],
    [MINUTE, "1 минуту назад"],
    [5 * MINUTE, "5 минут назад"],
    [HOUR, "1 час назад"],
    [2 * HOUR, "2 часа назад"],
    [23 * HOUR, "23 часа назад"],
    [DAY, "вчера"],
    [2 * DAY, "позавчера"],
    [5 * DAY, "5 дней назад"],
  ])("%i мс назад — %s", (ms, expected) => {
    expect(formatRelativeDate(ago(ms), now)).toBe(expected);
  });

  it("дни после первых суток считает по календарю Москвы", () => {
    // Суббота 23:00 МСК, сейчас понедельник 05:00 МСК: 30 часов, но это позавчера, а не вчера.
    const monday = new Date("2026-09-14T02:00:00Z");
    expect(formatRelativeDate(new Date("2026-09-12T20:00:00Z"), monday)).toBe("позавчера");
    // Меньше суток — по часам, даже если это уже вчерашняя дата.
    expect(formatRelativeDate(new Date("2026-09-13T20:00:00Z"), monday)).toBe("6 часов назад");
  });

  it("старше недели — дата без года в текущем году", () => {
    expect(formatRelativeDate(new Date("2026-09-01T12:00:00Z"), now)).toBe("1 сентября");
  });

  it("прошлый год — дата с годом", () => {
    expect(formatRelativeDate(new Date("2025-12-31T12:00:00Z"), now)).toBe("31 декабря 2025 г.");
  });

  it("считает дату по Москве, а не по UTC", () => {
    // 22:30 UTC 31 августа — это уже 1 сентября в Москве.
    expect(formatRelativeDate(new Date("2026-08-31T22:30:00Z"), now)).toBe("1 сентября");
  });
});

describe("isFresh", () => {
  it("свежая — меньше суток", () => {
    expect(isFresh(ago(23 * HOUR), now)).toBe(true);
    expect(isFresh(ago(DAY), now)).toBe(false);
  });
});

describe("formatEpisodeNumber", () => {
  it("дополняет до двух цифр и не режет длинные", () => {
    expect([1, 12, 108].map(formatEpisodeNumber)).toEqual(["01", "12", "108"]);
  });
});

describe("formatCount", () => {
  it.each([
    [1, "1 тайтл"],
    [3, "3 тайтла"],
    [8, "8 тайтлов"],
    [11, "11 тайтлов"],
    [21, "21 тайтл"],
    [0, "0 тайтлов"],
  ])("%i", (count, expected) => {
    expect(formatCount(count, ["тайтл", "тайтла", "тайтлов"])).toBe(expected);
  });
});

describe("formatScore", () => {
  it("всегда один знак после запятой и запятая, а не точка", () => {
    expect(formatScore(9)).toBe("9,0");
    expect(formatScore(10)).toBe("10,0");
    expect(formatScore(8.49)).toBe("8,5");
  });

  it("округляет по двоичному представлению: 8.45 уходит вниз", () => {
    // Не опечатка и не «починить обратно»: 8.45 в double чуть меньше 8.45, и toFixed даёт 8,4.
    expect(formatScore(8.45)).toBe("8,4");
    expect(formatScore(9.25)).toBe("9,3");
  });
});

describe("formatDuration", () => {
  it.each([
    [1440, "24:00"],
    [1470, "24:30"],
    [65, "1:05"],
    [6302, "1:45:02"],
    [0, "0:00"],
  ])("%i с — %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("formatSeason", () => {
  it("сезон с годом и без", () => {
    expect(formatSeason("spring_2022")).toBe("Весна 2022");
    expect(formatSeason("fall")).toBe("Осень");
  });

  it("незнакомое значение — не показываем, а не выводим сырую строку", () => {
    expect(formatSeason(null)).toBeNull();
    expect(formatSeason("ongoing_2024")).toBeNull();
    expect(formatSeason("winter_24")).toBe("Зима");
  });
});

describe("formatAgeRating", () => {
  it("переводит рейтинг Shikimori", () => {
    expect(formatAgeRating("pg_13")).toBe("PG-13, с 13 лет");
    expect(formatAgeRating("r_plus")).toBe("R+, с 17 лет");
  });

  it("«none» и мусор — null", () => {
    expect(formatAgeRating("none")).toBeNull();
    expect(formatAgeRating(null)).toBeNull();
  });
});

describe("formatAirDay", () => {
  it("1 — понедельник, 7 — воскресенье", () => {
    expect(formatAirDay(1)).toBe("по понедельникам");
    expect(formatAirDay(4)).toBe("по четвергам");
    expect(formatAirDay(7)).toBe("по воскресеньям");
  });

  it("вне недели — null", () => {
    expect(formatAirDay(0)).toBeNull();
    expect(formatAirDay(8)).toBeNull();
    expect(formatAirDay(null)).toBeNull();
  });
});

describe("isToday", () => {
  it("тот же календарный день по Москве, а не последние 24 часа", () => {
    // now — 15:00 по Москве 16 сентября.
    expect(isToday(ago(10 * HOUR), now)).toBe(true); // 05:00 того же дня
    expect(isToday(ago(16 * HOUR), now)).toBe(false); // 23:00 накануне, хотя меньше суток назад
  });
});

describe("moscowWeekday", () => {
  it("нумерация как у airDay: 1 — понедельник, 7 — воскресенье", () => {
    expect(moscowWeekday(new Date("2026-09-14T12:00:00Z"))).toBe(1);
    expect(moscowWeekday(new Date("2026-09-20T12:00:00Z"))).toBe(7);
  });

  it("день берётся по Москве, а не по UTC", () => {
    // 22:30 UTC в воскресенье — это уже 01:30 понедельника в Москве.
    expect(moscowWeekday(new Date("2026-09-20T22:30:00Z"))).toBe(1);
  });
});

describe("formatAirTime", () => {
  it("время по Москве, а не по UTC", () => {
    expect(formatAirTime(new Date("2026-09-27T14:15:00Z"))).toBe("17:15");
    expect(formatAirTime(new Date("2026-09-20T22:05:00Z"))).toBe("01:05");
  });
});
