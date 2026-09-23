/**
 * Сессии входа (docs/03, модели User и Session). В куке — случайный токен, в базе — sha256 от него.
 */
import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { prisma } from "@/lib/db";

import { type DisplayUser, SESSION_COOKIE, SESSION_TTL_MS } from "./display";
import type { GoogleIdentity } from "./google";
import { hashToken, randomToken } from "./tokens";

export interface SessionUser extends DisplayUser {
  id: string;
  role: "USER" | "ADMIN";
}

const USER_SELECT = { id: true, email: true, name: true, avatarUrl: true, role: true } as const;

/** Вход по Google: тот же sub — тот же пользователь; e-mail, имя и аватар обновляются. */
export async function upsertGoogleUser(identity: GoogleIdentity): Promise<SessionUser> {
  const fields = { email: identity.email, name: identity.name, avatarUrl: identity.avatarUrl };
  return prisma.user.upsert({
    where: { googleId: identity.googleId },
    create: { googleId: identity.googleId, ...fields },
    update: fields,
    select: USER_SELECT,
  });
}

export async function createSession(userId: string, now: Date = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/**
 * Пользователь по токену из куки. Выдуманный токен, токен удалённой сессии и просроченный — null.
 * Просроченная строка заодно удаляется: отдельной уборки сессий пока нет.
 */
export async function findSessionUser(token: string | undefined, now: Date = new Date()): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, expiresAt: true, user: { select: USER_SELECT } },
  });
  if (!session) return null;
  if (session.expiresAt <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

/** Выход: строка сессии удаляется, и токен больше ничего не открывает, даже если куку сохранили. */
export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/**
 * Кто вошёл — для server actions и динамических страниц. В статических страницах и лэйауте не
 * вызывать: чтение куки делает страницу динамической (шапка читает показную куку в браузере).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return findSessionUser(store.get(SESSION_COOKIE)?.value);
});

/** Атрибуты кук входа. Secure — на проде; на localhost браузер и так не пустил бы его по http. */
export function sessionCookieOptions(expiresAt: Date, httpOnly: boolean) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
