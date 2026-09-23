import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

/** Адрес из формы в tests/e2e/dmca.spec.ts: чистим только свои следы, чужие обращения не трогаем. */
const TEST_CLAIMANT_EMAIL = "legal@example.com";
/** Префикс googleId тестовых зрителей из tests/e2e: у настоящих Google id это число. */
const E2E_GOOGLE_PREFIX = "e2e-";

/**
 * Один раз на прогон: убрать обращения, оставленные прошлыми прогонами e2e.
 * Форма ограничивает поток по адресу (5 в час), и без очистки тест «обращение отправляется»
 * начинает падать на шестом прогоне за час — то есть зависеть от истории запусков, а не от кода.
 */
export default async function globalSetup(): Promise<void> {
  // Playwright .env.local не читает, в отличие от next dev и prisma.config.ts.
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  // e2e идут на локальной dev-базе (docs/07). Удалять что-то в удалённой базе эта очистка не должна никогда.
  const { hostname } = new URL(connectionString);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(`e2e подключены к базе на ${hostname}: прогон отменён, они пишут и удаляют данные`);
  }

  // Свой клиент, а не lib/db.ts: тот помечен server-only и в процессе Playwright не импортируется.
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.dmcaRequest.deleteMany({ where: { claimantEmail: TEST_CLAIMANT_EMAIL } });
    // Тестовые зрители из auth.spec.ts и bookmarks.spec.ts: их сессии и отметки от прошлых прогонов
    // уходят каскадом вместе с ними. Живых пользователей префикс «e2e-» не задевает.
    await prisma.user.deleteMany({ where: { googleId: { startsWith: E2E_GOOGLE_PREFIX } } });
  } finally {
    await prisma.$disconnect();
  }
}
