import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Клиент базы для e2e: свой, а не lib/db.ts (тот server-only). Только локальная база — e2e пишут и
 * удаляют данные, и в удалённую не должны попасть никогда (как в global-setup.ts).
 */
export function e2eDatabase(): PrismaClient {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("e2e: не задан DATABASE_URL");
  const { hostname } = new URL(connectionString);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(`e2e подключены к базе на ${hostname}: прогон отменён`);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export interface SeededViewer {
  googleId: string;
  email: string;
  name: string;
}

/**
 * Вошедший зритель без Google: пользователь и сессия пишутся в базу, а кука сессии и показная
 * кука — в контекст браузера. Каждый вызов — новая сессия того же пользователя: второй контекст
 * с ней — «другое устройство».
 */
export async function signInAs(
  context: import("@playwright/test").BrowserContext,
  baseURL: string | undefined,
  viewer: SeededViewer,
): Promise<{ token: string; userId: string }> {
  const { createHash, randomBytes } = await import("node:crypto");
  const { encodeDisplayUser } = await import("@/lib/auth/display");
  const prisma = e2eDatabase();
  try {
    const user = await prisma.user.upsert({
      where: { googleId: viewer.googleId },
      create: { googleId: viewer.googleId, email: viewer.email, name: viewer.name },
      update: { email: viewer.email, name: viewer.name },
    });
    const token = randomBytes(32).toString("base64url");
    await prisma.session.create({
      data: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const url = baseURL ?? "http://localhost:3100";
    await context.addCookies([
      { name: "aw_session", value: token, url, httpOnly: true, sameSite: "Lax" },
      {
        name: "aw_user",
        value: encodeDisplayUser({ name: viewer.name, email: viewer.email, avatarUrl: null }),
        url,
        sameSite: "Lax",
      },
    ]);
    return { token, userId: user.id };
  } finally {
    await prisma.$disconnect();
  }
}
