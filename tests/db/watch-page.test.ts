import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { SourceType } from "@/lib/generated/prisma/enums";
import { getWatchPage } from "@/lib/queries/watch";

import { createEpisode, createTitle } from "../factories/catalog";

describe("getWatchPage", () => {
  it("берёт фрейм Kodik, даже если по умолчанию стоит прямой файл: играет только фрейм", async () => {
    // Раньше источник выбирался среди всех типов: MP4 по умолчанию побеждал, плеер говорил «не
    // подключён», а плитка той же серии рядом — что подключена (hasSource считает только Kodik).
    const title = await createTitle({ slug: "default-mp4" });
    const episode = await createEpisode(title, { number: 1 });
    await prisma.source.createMany({
      data: [
        { episodeId: episode.id, type: SourceType.MP4, url: "https://example.com/1.mp4", isDefault: true, priority: 1 },
        { episodeId: episode.id, type: SourceType.KODIK, url: "https://kodik.info/seria/1", priority: 50 },
        { episodeId: episode.id, type: SourceType.KODIK, url: "https://kodik.info/seria/1b", priority: 10 },
      ],
    });

    const page = await getWatchPage("default-mp4", 1);
    expect(page?.episode.hasSource).toBe(true);
    expect(page?.source).toEqual({ type: SourceType.KODIK, url: "https://kodik.info/seria/1b" });
  });

  it("серия только с прямым файлом — без источника, как и в списке серий", async () => {
    const title = await createTitle({ slug: "only-mp4" });
    const episode = await createEpisode(title, { number: 1 });
    await prisma.source.create({ data: { episodeId: episode.id, type: SourceType.MP4, url: "https://example.com/1.mp4" } });

    const page = await getWatchPage("only-mp4", 1);
    expect(page?.episode.hasSource).toBe(false);
    expect(page?.source).toBeNull();
  });

  it("соседние серии — опубликованные, черновик между ними пропускается", async () => {
    const title = await createTitle({ slug: "neighbours" });
    await createEpisode(title, { number: 1 });
    await createEpisode(title, { number: 2, publishedAt: null });
    await createEpisode(title, { number: 3 });

    const page = await getWatchPage("neighbours", 3);
    expect(page?.previous?.number).toBe(1);
    expect(page?.next).toBeNull();
    expect(await getWatchPage("neighbours", 2)).toBeNull();
  });
});
