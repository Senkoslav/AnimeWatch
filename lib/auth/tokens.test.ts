import { describe, expect, it } from "vitest";

import { hashToken, pkceChallenge, randomToken, safeEqual } from "./tokens";

describe("токены", () => {
  it("code_challenge совпадает с примером из RFC 7636", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("токены случайные и годятся для адреса и куки", () => {
    const a = randomToken();
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it("хеш стабилен и не равен токену", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toContain("abc");
  });

  it("safeEqual не падает на строках разной длины", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
