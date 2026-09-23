import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const setRating = vi.fn();
const setListState = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/queries/bookmarks", () => ({
  getBookmark: vi.fn(),
  removeBookmark: vi.fn(),
  setListState: (...args: unknown[]) => setListState(...args),
  setRating: (...args: unknown[]) => setRating(...args),
}));

const { setMyListState, setMyRating } = await import("./actions");

const TITLE_ID = "cmfx0abcd0000abcd1234efgh";
const USER = { id: "u1", email: "v@example.com", name: null, avatarUrl: null, role: "USER" };

describe("server actions отметок", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("без сессии — приглашение войти, до проверки входа и до базы", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await setMyRating("мусор", 99)).toEqual({ ok: false, error: "signin" });
    expect(setRating).not.toHaveBeenCalled();
  });

  it("оценка вне 1–10, дробная и мусор вместо id до базы не доходят", async () => {
    getCurrentUser.mockResolvedValue(USER);
    for (const rating of [0, 11, 7.5]) {
      expect(await setMyRating(TITLE_ID, rating)).toEqual({ ok: false, error: "invalid" });
    }
    expect(await setMyRating("'; drop table", 5)).toEqual({ ok: false, error: "invalid" });
    // @ts-expect-error -- проверяем, что чужое значение списка отсекается в рантайме, а не только типом
    expect(await setMyListState(TITLE_ID, "FAVORITE")).toEqual({ ok: false, error: "invalid" });
    expect(setRating).not.toHaveBeenCalled();
    expect(setListState).not.toHaveBeenCalled();
  });

  it("сбой базы — понятный статус и запись в лог, а не падение страницы", async () => {
    getCurrentUser.mockResolvedValue(USER);
    setRating.mockRejectedValue(new Error("connection reset"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await setMyRating(TITLE_ID, 8)).toEqual({ ok: false, error: "failed" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("setMyRating"), "connection reset");
  });

  it("скрытый или несуществующий тайтл — «недоступен»", async () => {
    getCurrentUser.mockResolvedValue(USER);
    setRating.mockResolvedValue(null);
    expect(await setMyRating(TITLE_ID, 8)).toEqual({ ok: false, error: "unavailable" });
  });
});
