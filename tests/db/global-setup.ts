import { execFileSync } from "node:child_process";

import { testDatabaseUrl } from "./database-url";

/** Один раз на прогон: накатить миграции на тестовую базу. Если базы нет, Prisma её создаст. */
export default function setup(): void {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    // prisma.config.ts берёт URL из DIRECT_URL; .env.local уже заданные переменные не перезаписывает.
    env: { ...process.env, DIRECT_URL: testDatabaseUrl() },
    stdio: ["ignore", "ignore", "inherit"],
  });
}
