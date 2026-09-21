import { describe, expect, it } from "vitest";

import { PAGE_GAP, pageWindow, shownRange } from "./pages";

describe("pageWindow", () => {
  it("короткая выдача показывается номерами целиком", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("в начале длинной выдачи пропуск только справа", () => {
    expect(pageWindow(1, 24)).toEqual([1, 2, PAGE_GAP, 24]);
  });

  it("в середине пропуски с обеих сторон", () => {
    expect(pageWindow(12, 24)).toEqual([1, PAGE_GAP, 11, 12, 13, PAGE_GAP, 24]);
  });

  it("в конце пропуск только слева", () => {
    expect(pageWindow(24, 24)).toEqual([1, PAGE_GAP, 23, 24]);
  });

  it("пропуск вместо одного номера не ставится: «1 … 3» не короче «1 2 3»", () => {
    expect(pageWindow(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageWindow(5, 8)).toEqual([1, PAGE_GAP, 4, 5, 6, 7, 8]);
  });

  it("страница за пределами выдачи прижимается к краю, а не ломает ряд", () => {
    expect(pageWindow(99, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(0, 3)).toEqual([1, 2, 3]);
  });
});

describe("shownRange", () => {
  it("считает границы по странице", () => {
    expect(shownRange(1, 24, 348)).toEqual({ from: 1, to: 24 });
    expect(shownRange(3, 24, 348)).toEqual({ from: 49, to: 72 });
  });

  it("последняя страница обрезается по итогу, а не по размеру страницы", () => {
    expect(shownRange(2, 24, 30)).toEqual({ from: 25, to: 30 });
  });

  it("пустая выдача не показывает «1–0 из 0»", () => {
    expect(shownRange(1, 24, 0)).toEqual({ from: 0, to: 0 });
  });
});
