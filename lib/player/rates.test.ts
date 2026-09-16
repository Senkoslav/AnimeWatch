import { describe, expect, it } from "vitest";

import { formatRate, isKnownRate } from "./rates";

describe("formatRate", () => {
  it("по-русски: запятая и знак умножения", () => {
    expect(formatRate(0.75)).toBe("0,75×");
    expect(formatRate(1)).toBe("1×");
  });
});

describe("isKnownRate", () => {
  it("принимает только скорости из меню", () => {
    expect(isKnownRate(1.25)).toBe(true);
    expect(isKnownRate(0.2)).toBe(false);
    expect(isKnownRate("1")).toBe(false);
  });
});
