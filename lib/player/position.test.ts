import { describe, expect, it } from "vitest";

import { readNumber, resumeFrom } from "./position";

describe("resumeFrom", () => {
  it("продолжает с сохранённой позиции в середине серии", () => {
    expect(resumeFrom(600, 1440)).toBe(600);
  });

  it("начало и финальные титры — сначала", () => {
    expect(resumeFrom(3, 1440)).toBeNull();
    expect(resumeFrom(1420, 1440)).toBeNull();
  });

  it("у короткого видео пороги пропорциональны длительности", () => {
    expect(resumeFrom(4, 8)).toBe(4);
    expect(resumeFrom(0.5, 8)).toBeNull();
    expect(resumeFrom(7.5, 8)).toBeNull();
  });

  it("нет позиции или длительности — сначала", () => {
    expect(resumeFrom(null, 1440)).toBeNull();
    expect(resumeFrom(600, 0)).toBeNull();
    expect(resumeFrom(Number.NaN, 1440)).toBeNull();
  });
});

describe("readNumber", () => {
  function storage(values: Record<string, string>): Storage {
    return { getItem: (key: string) => values[key] ?? null } as Storage;
  }

  it("читает число и отличает отсутствие ключа от нуля", () => {
    expect(readNumber(storage({ a: "12.5", zero: "0" }), "a")).toBe(12.5);
    expect(readNumber(storage({ zero: "0" }), "zero")).toBe(0);
    expect(readNumber(storage({}), "a")).toBeNull();
    expect(readNumber(storage({ a: "мусор" }), "a")).toBeNull();
  });

  it("недоступное хранилище — null, а не исключение", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(readNumber(broken, "a")).toBeNull();
    expect(readNumber(undefined, "a")).toBeNull();
  });
});
