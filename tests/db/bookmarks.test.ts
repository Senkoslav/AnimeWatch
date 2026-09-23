import { describe, expect, it } from "vitest";

import { upsertGoogleUser } from "@/lib/auth/session";
import { TitleStatus, WatchState } from "@/lib/generated/prisma/enums";
import {
  getBookmark,
  getBookmarkStates,
  removeBookmark,
  setListState,
  setRating,
} from "@/lib/queries/bookmarks";

import { createTitle } from "../factories/catalog";

let viewers = 0;
async function viewer() {
  viewers += 1;
  return upsertGoogleUser({ googleId: `g-${viewers}`, email: `v${viewers}@example.com`, name: null, avatarUrl: null });
}

describe("отметки и оценки", () => {
  it("список ставится и меняется, оценка при смене списка остаётся", async () => {
    const user = await viewer();
    const title = await createTitle();

    expect(await setListState(user.id, title.id, WatchState.WATCHING)).toEqual({ state: "WATCHING", rating: null });
    await setRating(user.id, title.id, 8);
    expect(await setListState(user.id, title.id, WatchState.DROPPED)).toEqual({ state: "DROPPED", rating: 8 });
  });

  it("оценка тайтла вне списков кладёт его в «Просмотрено»", async () => {
    const user = await viewer();
    const title = await createTitle();
    expect(await setRating(user.id, title.id, 9)).toEqual({ state: "COMPLETED", rating: 9 });
  });

  it("снятие оценки не создаёт строку и не трогает список", async () => {
    const user = await viewer();
    const title = await createTitle();
    expect(await setRating(user.id, title.id, null)).toBeNull();
    expect(await getBookmark(user.id, title.id)).toBeNull();

    await setListState(user.id, title.id, WatchState.PLANNED);
    await setRating(user.id, title.id, 6);
    expect(await setRating(user.id, title.id, null)).toEqual({ state: "PLANNED", rating: null });
  });

  it("«убрать из списка» снимает и оценку", async () => {
    const user = await viewer();
    const title = await createTitle();
    await setRating(user.id, title.id, 7);
    await removeBookmark(user.id, title.id);
    expect(await getBookmark(user.id, title.id)).toBeNull();
  });

  it("черновик и скрытый по жалобе тайтл не отмечаются", async () => {
    const user = await viewer();
    const draft = await createTitle({ publishedAt: null });
    const hidden = await createTitle({ status: TitleStatus.HIDDEN });

    expect(await setListState(user.id, draft.id, WatchState.WATCHING)).toBeNull();
    expect(await setRating(user.id, hidden.id, 10)).toBeNull();
    expect(await setListState(user.id, "не-существует", WatchState.WATCHING)).toBeNull();
    expect(await getBookmark(user.id, draft.id)).toBeNull();
  });

  it("отметки для каталога — только свои и только для запрошенных тайтлов", async () => {
    const me = await viewer();
    const other = await viewer();
    const [a, b, c] = [await createTitle(), await createTitle(), await createTitle()];
    await setListState(me.id, a.id, WatchState.WATCHING);
    await setListState(other.id, b.id, WatchState.DROPPED);
    await setListState(me.id, c.id, WatchState.PLANNED);

    const states = await getBookmarkStates(me.id, [a.id, b.id]);
    expect(Object.fromEntries(states)).toEqual({ [a.id]: "WATCHING" });
    expect((await getBookmarkStates(me.id, [])).size).toBe(0);
  });
});
