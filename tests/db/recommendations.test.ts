import { describe, expect, it } from "vitest";

import { upsertGoogleUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { RelationKind, TitleStatus, WatchState } from "@/lib/generated/prisma/enums";
import { setListState } from "@/lib/queries/bookmarks";
import { dismissTitle, getRecommendations, restoreTitle } from "@/lib/queries/recommendations";

import { createTitle } from "../factories/catalog";

let n = 0;
async function viewer() {
  n += 1;
  return upsertGoogleUser({ googleId: `r-${n}`, email: `r${n}@example.com`, name: null, avatarUrl: null });
}

describe("рекомендации на базе", () => {
  it("аноним — холодный старт; черновик и скрытый по жалобе не советуются", async () => {
    const good = await createTitle({ score: 9, popularityRank: 1 });
    await createTitle({ score: 9.9, publishedAt: null });
    await createTitle({ score: 9.9, status: TitleStatus.HIDDEN });

    const result = await getRecommendations(null, 10);
    expect(result.personal).toBe(false);
    expect(result.items.map((item) => item.title.id)).toEqual([good.id]);
  });

  it("личные советы: продолжение просмотренного наверху, отмеченное не советуется", async () => {
    const user = await viewer();
    const sequel = await createTitle({ shikimoriId: 777, score: 6.5 });
    const season1 = await createTitle({ shikimoriId: 776, nameRu: "Первый сезон" });
    await prisma.titleRelation.create({
      data: { titleId: season1.id, targetShikimoriId: 777, kind: RelationKind.SEQUEL, rank: 1 },
    });
    await createTitle({ score: 9.5, popularityRank: 1 });
    for (let i = 0; i < 2; i++) await setListState(user.id, (await createTitle()).id, WatchState.WATCHING);
    await setListState(user.id, season1.id, WatchState.COMPLETED);

    const result = await getRecommendations(user.id, 5);
    expect(result.personal).toBe(true);
    expect(result.items[0]).toMatchObject({ title: { id: sequel.id }, reason: { type: "sequel", of: "Первый сезон" } });
    expect(result.items.some((item) => item.title.id === season1.id)).toBe(false);
  });

  it("«не интересно» убирает совет только у этого пользователя, «вернуть» возвращает", async () => {
    const me = await viewer();
    const other = await viewer();
    const title = await createTitle({ score: 9, popularityRank: 1 });

    expect(await dismissTitle(me.id, title.id)).toBe(true);
    expect(await dismissTitle(me.id, title.id)).toBe(true);
    expect((await getRecommendations(me.id, 5)).items.some((item) => item.title.id === title.id)).toBe(false);
    expect((await getRecommendations(other.id, 5)).items.some((item) => item.title.id === title.id)).toBe(true);

    await restoreTitle(me.id, title.id);
    expect((await getRecommendations(me.id, 5)).items.some((item) => item.title.id === title.id)).toBe(true);
  });

  it("скрыть можно только публичный тайтл", async () => {
    const user = await viewer();
    const draft = await createTitle({ publishedAt: null });
    expect(await dismissTitle(user.id, draft.id)).toBe(false);
    expect(await prisma.recommendationDismissal.count()).toBe(0);
  });
});
