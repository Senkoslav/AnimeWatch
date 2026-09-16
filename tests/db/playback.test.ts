import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { SourceType, TitleStatus } from "@/lib/generated/prisma/enums";
import { playbackTtlSeconds } from "@/lib/playback/policy";
import { getPlayback } from "@/lib/playback/server";
import { getWatchPage } from "@/lib/queries/watch";

import { createEpisode, createTitle } from "../factories/catalog";

const NOW = Date.UTC(2026, 8, 16, 12, 0, 0);

beforeEach(() => {
  process.env.BUNNY_CDN_HOSTNAME = "vz-test.b-cdn.net";
  process.env.BUNNY_TOKEN_KEY = "test-key";
});

afterEach(() => {
  delete process.env.BUNNY_CDN_HOSTNAME;
  delete process.env.BUNNY_TOKEN_KEY;
});

async function episodeWithSource(overrides: Parameters<typeof createTitle>[0] = {}, episodeOverrides = {}) {
  const title = await createTitle(overrides);
  const episode = await createEpisode(title, { duration: 1440, ...episodeOverrides });
  await prisma.source.create({
    data: { episodeId: episode.id, type: SourceType.HLS, url: "video-1", isDefault: true },
  });
  return { title, episode };
}

describe("getPlayback", () => {
  it("подписывает плейлист источника с токеном в пути и сроком «серия + запас»", async () => {
    const { episode } = await episodeWithSource();
    const playback = await getPlayback(episode.id, NOW);

    expect(playback).toMatchObject({ status: "ready", expiresAt: NOW / 1000 + playbackTtlSeconds(1440) });
    if (playback?.status !== "ready") throw new Error("ожидался ready");
    expect(playback.src).toMatch(
      /^https:\/\/vz-test\.b-cdn\.net\/bcdn_token=HS256-[\w-]+&token_path=%2Fvideo-1%2F&expires=\d+\/video-1\/playlist\.m3u8$/,
    );
  });

  it("опубликованная серия без источника — «обрабатывается»", async () => {
    const episode = await createEpisode(await createTitle());
    expect(await getPlayback(episode.id, NOW)).toEqual({ status: "processing" });
  });

  it("без ключей Bunny — понятная ошибка, а не URL без подписи", async () => {
    const { episode } = await episodeWithSource();
    delete process.env.BUNNY_TOKEN_KEY;
    await expect(getPlayback(episode.id, NOW)).rejects.toThrow(/BUNNY_TOKEN_KEY/);
  });

  describe("приватность (docs/07: /api/playback не отдаёт URL для неопубликованной серии)", () => {
    it("черновик серии — null", async () => {
      const { episode } = await episodeWithSource({}, { publishedAt: null });
      expect(await getPlayback(episode.id, NOW)).toBeNull();
    });

    it("серия черновика тайтла — null", async () => {
      const { episode } = await episodeWithSource({ publishedAt: null });
      expect(await getPlayback(episode.id, NOW)).toBeNull();
    });

    it("серия тайтла, скрытого по жалобе, — null", async () => {
      const { episode } = await episodeWithSource({ status: TitleStatus.HIDDEN });
      expect(await getPlayback(episode.id, NOW)).toBeNull();
    });
  });
});

describe("getWatchPage", () => {
  it("соседние серии пропускают черновики", async () => {
    const title = await createTitle({ slug: "frieren" });
    for (const [number, published] of [
      [1, true],
      [2, false],
      [3, true],
      [4, true],
    ] as const) {
      await createEpisode(title, { number, publishedAt: published ? new Date(NOW) : null });
    }

    const page = await getWatchPage("frieren", 3);
    expect(page?.previous?.number).toBe(1);
    expect(page?.next?.number).toBe(4);
    expect(page?.playback).toEqual({ status: "processing" });

    expect(await getWatchPage("frieren", 2)).toBeNull();
    expect((await getWatchPage("frieren", 4))?.next).toBeNull();
  });
});
