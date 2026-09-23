import { describe, expect, it } from "vitest";

import { isLocalPath, safeReturnTo } from "./return-to";

const ORIGIN = "https://animewatch.example";

describe("safeReturnTo", () => {
  it("возвращает на страницу своего сайта вместе с адресной строкой", () => {
    expect(safeReturnTo(`${ORIGIN}/anime/frieren?x=1`, ORIGIN)).toBe("/anime/frieren?x=1");
  });

  it("чужой хост, мусор, служебные адреса и пустой Referer — на главную", () => {
    expect(safeReturnTo("https://evil.example/anime/frieren", ORIGIN)).toBe("/");
    expect(safeReturnTo("javascript:alert(1)", ORIGIN)).toBe("/");
    expect(safeReturnTo("не адрес", ORIGIN)).toBe("/");
    expect(safeReturnTo(`${ORIGIN}/api/auth/google`, ORIGIN)).toBe("/");
    expect(safeReturnTo(`${ORIGIN}/auth/error`, ORIGIN)).toBe("/");
    expect(safeReturnTo(null, ORIGIN)).toBe("/");
  });

  it("путь из куки — только локальный", () => {
    expect(isLocalPath("/catalog")).toBe(true);
    expect(isLocalPath("//evil.example")).toBe(false);
    expect(isLocalPath("/\\evil.example")).toBe(false);
    expect(isLocalPath("https://evil.example")).toBe(false);
  });
});
