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
