import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";

import { cleanDescription, episodeCount, mapTitle } from "./map";
import { animeNodeSchema } from "./schema";

// Фикстура — настоящий ответ shikimori.io, снятый 2026-09-18.
const FIXTURE = JSON.parse(readFileSync("tests/fixtures/shikimori-animes.json", "utf8")) as {
  data: { animes: unknown[] };
};

function node(shikimoriId: number) {
  const raw = FIXTURE.data.animes.find((anime) => (anime as { id: string }).id === String(shikimoriId));
  return animeNodeSchema.parse(raw);
}

describe("mapTitle на живом ответе API", () => {
  it("завершённый сериал разбирается целиком", () => {
    const title = mapTitle(node(16498));

    expect(title).toMatchObject({
      shikimoriId: 16498,
      name: "Shingeki no Kyojin",
      nameRu: "Атака титанов",
      kind: TitleKind.TV,
      status: TitleStatus.COMPLETED,
      year: 2013,
      season: "spring_2013",
      ageRating: "r",
      totalEpisodes: 25,
      episodeCount: 25,
      // duration у них в минутах, у нас секунды.
      episodeSeconds: 24 * 60,
    });
    expect(title?.genres).toContain("Экшен");
    expect(title?.synonyms).toContain("Attack on Titan");
    expect(title?.posterUrl).toMatch(/^https:\/\/shikimori\.io\/uploads\/poster\/animes\//);
  });

  it("синонимы без повторов и без пустых значений", () => {
    const title = mapTitle(node(52991));
    expect(title?.synonyms).toEqual([...new Set(title?.synonyms)]);
    expect(title?.synonyms.every((synonym) => synonym.trim().length > 0)).toBe(true);
  });
});

describe("оценка", () => {
  it("их 0.0 — это «никто не оценил», а не ноль", () => {
    expect(mapTitle({ ...node(16498), score: 0 })?.score).toBeNull();
    expect(mapTitle({ ...node(16498), score: null })?.score).toBeNull();
    expect(mapTitle({ ...node(16498), score: undefined })?.score).toBeNull();
  });

  it("настоящая оценка доходит без округления: округляет показ, а не хранение", () => {
    expect(mapTitle({ ...node(16498), score: 8.49 })?.score).toBe(8.49);
  });
});

describe("episodeCount", () => {
  it("у онгоинга считает вышедшие, у завершённого — заявленные", () => {
    // «Ван-Пис»: episodes 0, episodesAired 1178. «Стальной алхимик»: 64 и 0.
    expect(episodeCount(node(21))).toBe(1178);
    expect(episodeCount(node(5114))).toBe(64);
  });

  it("у выходящего тайтла не заводит серии вперёд заявленных", () => {
    expect(episodeCount({ status: "ongoing", episodes: 12, episodesAired: 5 })).toBe(5);
    expect(episodeCount({ status: "released", episodes: 12, episodesAired: 0 })).toBe(12);
    expect(episodeCount({ status: "anons", episodes: 0, episodesAired: 0 })).toBe(0);
  });
});

describe("cleanDescription", () => {
  it("убирает их теги и оставляет текст внутри", () => {
    const cleaned = cleanDescription("[character=40]Луффи[/character] отправился в путь");
    expect(cleaned).toBe("Луффи отправился в путь");
  });

  it("японские имена в квадратных скобках — это текст, а не разметка", () => {
    expect(cleanDescription("Эрен [エレン・イェーガー] кричит")).toBe("Эрен [エレン・イェーガー] кричит");
  });

  it("пустое описание — null, а не пустая строка", () => {
    expect(cleanDescription(null)).toBeNull();
    expect(cleanDescription("   ")).toBeNull();
    expect(cleanDescription("[b][/b]")).toBeNull();
  });

  it("в описаниях из фикстуры не остаётся теговой разметки", () => {
    for (const anime of FIXTURE.data.animes) {
      const title = mapTitle(animeNodeSchema.parse(anime));
      expect(title?.description ?? "", String((anime as { id: string }).id)).not.toMatch(/\[\/?[a-z_]+(=[^\]]*)?\]/);
    }
  });
});

describe("отбраковка", () => {
  it("неизвестный тип и неизвестный статус в каталог не попадают", () => {
    const base = node(16498);
    expect(mapTitle({ ...base, kind: "music" })).toBeNull();
    expect(mapTitle({ ...base, kind: "cm" })).toBeNull();
    expect(mapTitle({ ...base, status: "неведомо" })).toBeNull();
    expect(mapTitle({ ...base, kind: null })).toBeNull();
  });

  it("tv_special считается спешлом, а не отдельным типом", () => {
    expect(mapTitle({ ...node(16498), kind: "tv_special" })?.kind).toBe(TitleKind.SPECIAL);
  });

  it("без русского названия показываем оригинальное", () => {
    expect(mapTitle({ ...node(16498), russian: null })?.nameRu).toBe("Shingeki no Kyojin");
  });
});
