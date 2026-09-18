import { describe, expect, it } from "vitest";

import { slugSchema } from "@/lib/slug";

import { buildSlug } from "./slug";

describe("buildSlug", () => {
  it("латинское название превращается в slug", () => {
    expect(buildSlug({ english: "Attack on Titan", name: "Shingeki no Kyojin", shikimoriId: 16498 })).toBe(
      "attack-on-titan",
    );
  });

  it("берёт ромадзи, если английского нет", () => {
    expect(buildSlug({ english: null, name: "Sousou no Frieren", shikimoriId: 52991 })).toBe("sousou-no-frieren");
  });

  it("знаки препинания и диакритика не ломают формат", () => {
    for (const name of ["Re:Zero — Starting Life", "Kaijuu Nº8", "Gintama°", "FLCL!!", "  Trailing  "]) {
      const slug = buildSlug({ english: name, name, shikimoriId: 1 });
      expect(slugSchema.safeParse(slug).success, `${name} → ${slug}`).toBe(true);
    }
  });

  it("при коллизии добавляется год, затем id", () => {
    const taken = new Set(["one-piece"]);
    expect(buildSlug({ english: "One Piece", name: "One Piece", year: 1999, shikimoriId: 21 }, taken)).toBe(
      "one-piece-1999",
    );

    taken.add("one-piece-1999");
    expect(buildSlug({ english: "One Piece", name: "One Piece", year: 1999, shikimoriId: 21 }, taken)).toBe(
      "one-piece-21",
    );
  });

  it("название без латиницы даёт slug из id, а не пустоту", () => {
    expect(buildSlug({ english: null, name: "進撃の巨人", shikimoriId: 16498 })).toBe("anime-16498");
  });

  it("длинное название обрезается по границе слова и проходит схему", () => {
    const long = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
    const slug = buildSlug({ english: long, name: long, shikimoriId: 7 });

    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug.endsWith("-")).toBe(false);
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });
});
