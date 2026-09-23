import { beforeEach, describe, expect, it, vi } from "vitest";

const searchTitles = vi.fn();
const hitRateLimit = vi.fn();

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }) }));
vi.mock("@/lib/queries/search", () => ({ searchTitles: (...args: unknown[]) => searchTitles(...args) }));
vi.mock("@/lib/rate-limit", () => ({ hitRateLimit: (...args: unknown[]) => hitRateLimit(...args) }));

const { quickSearch } = await import("./actions");

function title(n: number) {
  return { id: `t${n}`, slug: `s${n}`, nameRu: `Тайтл ${n}`, posterUrl: null, kind: "TV", year: 2024, score: null };
}

describe("quickSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hitRateLimit.mockResolvedValue({ limited: false });
  });

  it("короче двух букв и мусор вместо строки — пусто, без лимита и без базы", async () => {
    expect(await quickSearch("ф")).toEqual({ ok: true, query: "ф", titles: [], more: false });
    expect(await quickSearch({ q: "фрирен" })).toMatchObject({ ok: true, titles: [] });
    expect(hitRateLimit).not.toHaveBeenCalled();
    expect(searchTitles).not.toHaveBeenCalled();
  });

  it("отдаёт до восьми тайтлов без лишних полей и говорит, что есть ещё", async () => {
    searchTitles.mockResolvedValue({ titles: Array.from({ length: 12 }, (_, i) => title(i)), truncated: false });
    const result = await quickSearch("  тайтл  ");
    expect(result).toMatchObject({ ok: true, query: "тайтл", more: true });
    if (!result.ok) throw new Error("ожидался успех");
    expect(result.titles).toHaveLength(8);
    expect(Object.keys(result.titles[0] ?? {}).sort()).toEqual(["kind", "nameRu", "posterUrl", "slug", "year"]);
    expect(hitRateLimit).toHaveBeenCalledWith("search", "203.0.113.5", expect.anything());
  });

  it("превышен лимит — понятный отказ, база не трогается", async () => {
    hitRateLimit.mockResolvedValue({ limited: true });
    expect(await quickSearch("фрирен")).toEqual({ ok: false, query: "фрирен", error: "limited" });
    expect(searchTitles).not.toHaveBeenCalled();
  });

  it("сбой базы — статус и лог, а не исключение в окне", async () => {
    searchTitles.mockRejectedValue(new Error("connection reset"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await quickSearch("фрирен")).toEqual({ ok: false, query: "фрирен", error: "failed" });
  });
});
