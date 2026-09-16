/**
 * Клиент Prisma для серверного кода Next.js. server-only роняет сборку, если модуль
 * попадёт в клиентский компонент: вместе с ним туда уехал бы DATABASE_URL.
 */
import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

function createPrismaClient(): PrismaClient {
  // В проде это строка через пулер: serverless-функции открывают соединения агрессивно.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL не задан: локально добавь его в .env.local, образец в .env.example");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// В dev горячая перезагрузка заново исполняет модуль, и каждый раз открывался бы новый пул.
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
