import { describe, expect, it } from "vitest";

import { SourceType } from "@/lib/generated/prisma/enums";

import { pickSource, playbackTtlSeconds, TOKEN_MARGIN_SECONDS, UNKNOWN_DURATION_TTL_SECONDS } from "./policy";

describe("playbackTtlSeconds", () => {
  it("покрывает длительность серии с запасом", () => {
    expect(playbackTtlSeconds(1440)).toBe(1440 + TOKEN_MARGIN_SECONDS);
    expect(playbackTtlSeconds(1440.4)).toBe(1441 + TOKEN_MARGIN_SECONDS);
  });

  it("без длительности — срок на полнометражный фильм", () => {
    expect(playbackTtlSeconds(null)).toBe(UNKNOWN_DURATION_TTL_SECONDS);
    expect(playbackTtlSeconds(0)).toBe(UNKNOWN_DURATION_TTL_SECONDS);
  });
});

describe("pickSource", () => {
  const source = (url: string, overrides: Partial<Parameters<typeof pickSource>[0][number]> = {}) => ({
    type: SourceType.HLS,
    url,
    isDefault: false,
    priority: 100,
    ...overrides,
  });

  it("сначала источник по умолчанию, даже если у другого приоритет выше", () => {
    expect(pickSource([source("a", { priority: 1 }), source("b", { isDefault: true, priority: 500 })])?.url).toBe("b");
  });

  it("без источника по умолчанию — меньший priority", () => {
    expect(pickSource([source("a", { priority: 50 }), source("b", { priority: 10 })])?.url).toBe("b");
  });

  it("не HLS и пустые URL не играем", () => {
    expect(
      pickSource([source("iframe", { type: SourceType.EXTERNAL, isDefault: true }), source("", { priority: 1 })]),
    ).toBeUndefined();
  });

  it("не меняет порядок исходного массива", () => {
    const sources = [source("a", { priority: 50 }), source("b", { priority: 10 })];
    pickSource(sources);
    expect(sources.map((item) => item.url)).toEqual(["a", "b"]);
  });
});
