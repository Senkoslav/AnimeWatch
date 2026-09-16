import { afterAll, beforeEach } from "vitest";

import { prisma } from "@/lib/db";

// Каждый тест начинает с пустой базы. Не транзакция с откатом: код под тестом сам открывает
// транзакции Prisma, а вложить их во внешнюю без переписывания запросов нельзя.
let tables: string[] | undefined;

beforeEach(async () => {
  tables ??= (
    await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  ).map(({ tablename }) => `"public"."${tablename}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
