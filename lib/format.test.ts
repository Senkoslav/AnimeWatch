import { describe, expect, it } from "vitest";

import { formatCount, formatDuration, formatEpisodeNumber, formatRelativeDate, isFresh } from "./format";

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
