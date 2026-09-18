import { describe, expect, it } from "vitest";

import { episodeWindow, EPISODE_WINDOW } from "./episodes";

const episodes = (count: number) => Array.from({ length: count }, (_, index) => ({ number: index + 1 }));

describe("episodeWindow", () => {
  it("короткий список отдаётся целиком", () => {
    const window = episodeWindow(episodes(12));
    expect(window).toMatchObject({ capped: false, first: 1, last: 12, total: 12 });
    expect(window.episodes).toHaveLength(12);
  });

  it("длинный список урезается до последних серий", () => {
    const window = episodeWindow(episodes(1178));
    expect(window).toMatchObject({ capped: true, last: 1178, total: 1178 });
    expect(window.episodes).toHaveLength(EPISODE_WINDOW);
    expect(window.first).toBe(1178 - EPISODE_WINDOW + 1);
  });

  it("при просмотре окно включает текущую серию", () => {
    for (const current of [1, 300, 1178]) {
      const window = episodeWindow(episodes(1178), current);
      expect(
        window.episodes.some((episode) => episode.number === current),
        `серия ${current}`,
      ).toBe(true);
      expect(window.episodes).toHaveLength(EPISODE_WINDOW);
    }
  });

  it("ровно на границе список не режется", () => {
    expect(episodeWindow(episodes(EPISODE_WINDOW)).capped).toBe(false);
    expect(episodeWindow(episodes(EPISODE_WINDOW + 1)).capped).toBe(true);
  });

  it("пустой список не роняет счётчики", () => {
    expect(episodeWindow([])).toMatchObject({ capped: false, first: 0, last: 0, total: 0 });
  });
});
