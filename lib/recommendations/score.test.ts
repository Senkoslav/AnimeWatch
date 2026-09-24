import { describe, expect, it } from "vitest";

import { RelationKind, WatchState } from "@/lib/generated/prisma/enums";

import { reasonText } from "./reason";
import { type CatalogEntry, type Mark, markWeight, MIN_POSITIVE_MARKS, recommend } from "./score";

let next = 0;
function title(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  next += 1;
  return {
    id: `t${next}`,
    shikimoriId: 1000 + next,
    nameRu: `Тайтл ${next}`,
    genres: [],
    score: 7,
    popularityRank: null,
    relations: [],
    ...overrides,
  };
}

const mark = (entry: CatalogEntry, state: WatchState, rating: number | null = null): Mark => ({
  titleId: entry.id,
  state,
  rating,
});

/** Три «смотрю» на нейтральных тайтлах: личные советы включаются, вкус ни к чему не тянет. */
function warmup(): { entries: CatalogEntry[]; marks: Mark[] } {
  const entries = Array.from({ length: MIN_POSITIVE_MARKS }, () => title({ genres: ["Нейтральный"] }));
  return { entries, marks: entries.map((entry) => mark(entry, WatchState.WATCHING)) };
}

function ids(result: ReturnType<typeof recommend>) {
  return result.items.map((item) => item.titleId);
}

describe("вес отметки", () => {
  it("оценка решает: 10 — плюс, 1 и 3 — минус, даже у досмотренного", () => {
    expect(markWeight({ state: WatchState.COMPLETED, rating: 10 })).toBe(1);
    expect(markWeight({ state: WatchState.COMPLETED, rating: 1 })).toBe(-1);
    expect(markWeight({ state: WatchState.COMPLETED, rating: 3 })).toBeLessThan(0);
  });

  it("без оценки — список: брошено минус, отложено слабый плюс, смотрю сильнее всего", () => {
    expect(markWeight({ state: WatchState.DROPPED, rating: null })).toBeLessThan(0);
    const onHold = markWeight({ state: WatchState.ON_HOLD, rating: null });
    expect(onHold).toBeGreaterThan(0);
    expect(onHold).toBeLessThan(markWeight({ state: WatchState.PLANNED, rating: null }));
    expect(markWeight({ state: WatchState.WATCHING, rating: null })).toBeGreaterThan(
      markWeight({ state: WatchState.COMPLETED, rating: null }),
    );
  });
});

describe("recommend", () => {
  it("меньше трёх положительных отметок — честный холодный старт: оценка и популярность", () => {
    const top = title({ score: 9.1, popularityRank: 1 });
    const weak = title({ score: 6.2, popularityRank: 400 });
    const liked = title({ genres: ["Драма"] });
    const result = recommend({
      catalog: [weak, top, liked],
      marks: [mark(liked, WatchState.WATCHING)],
      dismissed: [],
      limit: 5,
    });

    expect(result.personal).toBe(false);
    expect(ids(result)).toEqual([top.id, weak.id]);
    expect(result.items[0]?.reason).toEqual({ type: "popular", score: 9.1 });
  });

  it("уже отмеченное и скрытое не советуется", () => {
    const { entries, marks } = warmup();
    const hidden = title();
    const free = title();
    const result = recommend({ catalog: [...entries, hidden, free], marks, dismissed: [hidden.id], limit: 10 });
    expect(ids(result)).toEqual([free.id]);
  });

  it("любимые жанры тянут вверх, жанры брошенного и низко оценённого — вниз", () => {
    const { entries, marks } = warmup();
    const loved = title({ genres: ["Драма"] });
    const dropped = title({ genres: ["Меха"] });
    const disliked = title({ genres: ["Спорт"] });
    const drama = title({ genres: ["Драма"] });
    const mecha = title({ genres: ["Меха"] });
    const sport = title({ genres: ["Спорт"] });
    const result = recommend({
      catalog: [...entries, loved, dropped, disliked, drama, mecha, sport],
      marks: [
        ...marks,
        mark(loved, WatchState.COMPLETED, 9),
        mark(dropped, WatchState.DROPPED),
        mark(disliked, WatchState.COMPLETED, 2),
      ],
      dismissed: [],
      limit: 3,
    });

    expect(ids(result)[0]).toBe(drama.id);
    expect(ids(result).indexOf(mecha.id)).toBeGreaterThan(ids(result).indexOf(drama.id));
    expect(result.items[0]?.reason).toEqual({ type: "genres", genres: ["Драма"] });
  });

  it("продолжение досмотренного — наверху и с объяснением", () => {
    const { entries, marks } = warmup();
    const sequel = title({ score: 6.5 });
    const season1 = title({
      nameRu: "Фрирен",
      relations: [{ targetShikimoriId: sequel.shikimoriId ?? 0, kind: RelationKind.SEQUEL, rank: 1 }],
    });
    const famous = title({ score: 9.5, popularityRank: 1 });
    const result = recommend({
      catalog: [...entries, season1, sequel, famous],
      marks: [...marks, mark(season1, WatchState.COMPLETED)],
      dismissed: [],
      limit: 2,
    });

    expect(ids(result)[0]).toBe(sequel.id);
    expect(reasonText(result.items[0]!.reason)).toBe("Продолжение «Фрирен»");
  });

  it("продолжение брошенного не советуется как продолжение", () => {
    const { entries, marks } = warmup();
    const sequel = title();
    const season1 = title({
      relations: [{ targetShikimoriId: sequel.shikimoriId ?? 0, kind: RelationKind.SEQUEL, rank: 1 }],
    });
    const result = recommend({
      catalog: [...entries, season1, sequel],
      marks: [...marks, mark(season1, WatchState.DROPPED)],
      dismissed: [],
      limit: 5,
    });
    expect(result.items.find((item) => item.titleId === sequel.id)?.reason.type).not.toBe("sequel");
  });

  it("похожее на высоко оценённое — вверх, похожее на брошенное — вниз; связь работает в обе стороны", () => {
    const { entries, marks } = warmup();
    const likeLoved = title();
    const likeDropped = title();
    const plain = title();
    const loved = title({
      nameRu: "Любимый",
      relations: [{ targetShikimoriId: likeLoved.shikimoriId ?? 0, kind: RelationKind.SIMILAR, rank: 1 }],
    });
    const dropped = title({ nameRu: "Брошенный" });
    // Обратная сторона: у кандидата в «похожих» стоит брошенный тайтл.
    likeDropped.relations = [{ targetShikimoriId: dropped.shikimoriId ?? 0, kind: RelationKind.SIMILAR, rank: 1 }];

    const result = recommend({
      catalog: [...entries, loved, dropped, likeLoved, likeDropped, plain],
      marks: [...marks, mark(loved, WatchState.COMPLETED, 10), mark(dropped, WatchState.DROPPED)],
      dismissed: [],
      limit: 3,
    });

    expect(ids(result)).toEqual([likeLoved.id, plain.id, likeDropped.id]);
    expect(reasonText(result.items[0]!.reason)).toBe("Похоже на «Любимый» — вы поставили 10");
  });

  it("разнообразие: при равном счёте второй совет — из другого жанра, а не ещё одна драма", () => {
    const { entries, marks } = warmup();
    const catalog = [
      ...entries,
      title({ id: "a-drama", genres: ["Драма"], score: 8 }),
      title({ id: "b-drama", genres: ["Драма"], score: 8 }),
      title({ id: "c-comedy", genres: ["Комедия"], score: 7.9 }),
    ];
    const result = recommend({ catalog, marks, dismissed: [], limit: 2 });
    expect(ids(result)).toEqual(["a-drama", "c-comedy"]);
  });

  it("отметка на тайтле вне каталога (скрыт по жалобе) не участвует", () => {
    const { entries, marks } = warmup();
    const candidate = title({ genres: ["Драма"] });
    const result = recommend({
      catalog: [...entries, candidate],
      marks: [...marks, { titleId: "hidden-title", state: WatchState.DROPPED, rating: null }],
      dismissed: [],
      limit: 5,
    });
    expect(ids(result)).toEqual([candidate.id]);
  });
});

describe("reasonText", () => {
  it("говорит по-человечески", () => {
    expect(reasonText({ type: "genres", genres: ["Драма", "Фэнтези"] })).toBe("Ваши жанры: драма и фэнтези");
    expect(reasonText({ type: "genres", genres: ["Драма"] })).toBe("Ваш жанр: драма");
    expect(reasonText({ type: "similar", of: "Фрирен", rating: null, state: WatchState.WATCHING })).toBe(
      "Похоже на «Фрирен» из списка «Смотрю»",
    );
    expect(reasonText({ type: "popular", score: 8.94 })).toBe("Оценка Shikimori 8,9");
    expect(reasonText({ type: "popular", score: null })).toBe("Популярно на Shikimori");
  });
});
