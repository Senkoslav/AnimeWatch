import { describe, expect, it } from "vitest";

import { siteUrl } from "./url";

describe("siteUrl", () => {
  it("первым берёт NEXT_PUBLIC_SITE_URL, от него — только происхождение", () => {
    expect(
      siteUrl({ NEXT_PUBLIC_SITE_URL: "https://anime.example/ru/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }).href,
    ).toBe("https://anime.example/");
  });

  it("без своего env — адрес прода от Vercel, со схемой https", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "animewatch-gamma.vercel.app" }).href).toBe(
      "https://animewatch-gamma.vercel.app/",
    );
  });

  it("мусор и чужие схемы пропускаются, в конце — localhost", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" }).href).toBe("http://localhost:3000/");
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "не адрес", VERCEL_PROJECT_PRODUCTION_URL: "" }).href).toBe(
      "http://localhost:3000/",
    );
    expect(siteUrl({}).href).toBe("http://localhost:3000/");
  });
});
