import { describe, expect, it } from "vitest";

import { upsertGoogleUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TitleStatus, WatchState } from "@/lib/generated/prisma/enums";
import { setListState, setRating } from "@/lib/queries/bookmarks";
import { getProfile } from "@/lib/queries/profile";

import { createTitle } from "../factories/catalog";

let n = 0;
async function viewer() {
  n += 1;
  return upsertGoogleUser({ googleId: `p-${n}`, email: `p${n}@example.com`, name: null, avatarUrl: null });
}

describe("профиль", () => {
  it("счётчики списков, оценки и средняя сходятся с содержимым Bookmark", async () => {
    const user = await viewer();
    const titles = await Promise.all(Array.from({ length: 5 }, () => createTitle()));
    const [a, b, c, d, e] = titles.map((title) => title.id) as [string, string, string, string, string];
    await setListState(user.id, a, WatchState.WATCHING);
    await setListState(user.id, b, WatchState.WATCHING);
    await setListState(user.id, c, WatchState.PLANNED);
    await setRating(user.id, d, 8); // вне списков — «Просмотрено»
    await setRating(user.id, e, 6);
    await setRating(user.id, a, 8);

    const profile = await getProfile(user.id);
    expect(profile?.lists).toEqual([
      { state: "WATCHING", count: 2 },
      { state: "PLANNED", count: 1 },
      { state: "COMPLETED", count: 2 },
      { state: "DROPPED", count: 0 },
    ]);
    expect(profile?.total).toBe(await prisma.bookmark.count({ where: { userId: user.id } }));
    expect(profile?.ratings).toEqual([0, 0, 0, 0, 0, 1, 0, 2, 0, 0]);
    expect(profile?.rated).toBe(3);
    expect(profile?.average).toBeCloseTo(22 / 3);
  });

  it("«последнее» — свежие сверху, «продолжить» — последний «Смотрю»", async () => {
    const user = await viewer();
    const first = await createTitle({ slug: "first-watching" });
    const second = await createTitle({ slug: "second-watching" });
    const planned = await createTitle({ slug: "planned-last" });
    await setListState(user.id, first.id, WatchState.WATCHING);
    await setListState(user.id, second.id, WatchState.WATCHING);
    await setListState(user.id, planned.id, WatchState.PLANNED);
    // Три записи подряд укладываются в одну миллисекунду: время правки разносим явно.
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
    for (const [title, age] of [[first, 3], [second, 2], [planned, 1]] as const) {
      await prisma.bookmark.update({
        where: { userId_titleId: { userId: user.id, titleId: title.id } },
        data: { updatedAt: minutesAgo(age) },
      });
    }

    const profile = await getProfile(user.id);
    expect(profile?.recent.map((item) => item.slug)).toEqual(["planned-last", "second-watching", "first-watching"]);
    expect(profile?.continueSlug).toBe("second-watching");
  });

  it("скрытый по жалобе тайтл и чужие отметки в профиль не попадают", async () => {
    const me = await viewer();
    const other = await viewer();
    const visible = await createTitle();
    const hidden = await createTitle();
    await setListState(me.id, visible.id, WatchState.WATCHING);
    await setListState(me.id, hidden.id, WatchState.DROPPED);
    await prisma.title.update({ where: { id: hidden.id }, data: { status: TitleStatus.HIDDEN } });
    await setListState(other.id, visible.id, WatchState.COMPLETED);

    const profile = await getProfile(me.id);
    expect(profile?.total).toBe(1);
    expect(profile?.lists.find((list) => list.state === "DROPPED")?.count).toBe(0);
    expect(profile?.recent).toHaveLength(1);
  });

  it("пустой профиль — нули, а не ошибка; средней нет", async () => {
    const user = await viewer();
    expect(await getProfile(user.id)).toMatchObject({ total: 0, rated: 0, average: null, recent: [], continueSlug: null });
    expect(await getProfile("не-существует")).toBeNull();
  });
});
