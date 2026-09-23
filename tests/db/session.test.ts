import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createSession, deleteSession, findSessionUser, upsertGoogleUser } from "@/lib/auth/session";
import { hashToken } from "@/lib/auth/tokens";

const IDENTITY = { googleId: "google-1", email: "viewer@example.com", name: "Зритель", avatarUrl: null };

describe("сессии входа", () => {
  it("по токену из куки находится свой пользователь, а в базе лежит только хеш токена", async () => {
    const user = await upsertGoogleUser(IDENTITY);
    const { token } = await createSession(user.id);

    expect(await findSessionUser(token)).toMatchObject({ id: user.id, email: "viewer@example.com" });
    const stored = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toContain(token);
  });

  it("подделка не проходит: выдуманный токен, id пользователя и хеш вместо токена — никто", async () => {
    const user = await upsertGoogleUser(IDENTITY);
    const { token } = await createSession(user.id);

    expect(await findSessionUser("выдуманный-токен")).toBeNull();
    expect(await findSessionUser(user.id)).toBeNull();
    expect(await findSessionUser(hashToken(token))).toBeNull();
    expect(await findSessionUser(undefined)).toBeNull();
  });

  it("сессия одного не открывает другого", async () => {
    const first = await upsertGoogleUser(IDENTITY);
    const second = await upsertGoogleUser({ ...IDENTITY, googleId: "google-2", email: "other@example.com" });
    const { token } = await createSession(first.id);
    expect((await findSessionUser(token))?.id).not.toBe(second.id);
  });

  it("просроченная сессия — никто, и её строка удаляется", async () => {
    const user = await upsertGoogleUser(IDENTITY);
    const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const { token } = await createSession(user.id, past);

    expect(await findSessionUser(token)).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("выход удаляет сессию: сохранённая кука больше ничего не открывает", async () => {
    const user = await upsertGoogleUser(IDENTITY);
    const { token } = await createSession(user.id);
    await deleteSession(token);
    expect(await findSessionUser(token)).toBeNull();
  });

  it("повторный вход обновляет e-mail и имя и не плодит пользователей", async () => {
    await upsertGoogleUser(IDENTITY);
    const again = await upsertGoogleUser({ ...IDENTITY, email: "new@example.com", name: "Новое имя" });
    expect(again).toMatchObject({ email: "new@example.com", name: "Новое имя" });
    expect(await prisma.user.count()).toBe(1);
  });
});
