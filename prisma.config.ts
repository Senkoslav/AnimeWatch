import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 сам .env не читает. Локально переменные в .env.local (как у Next), на Vercel и в CI — в окружении.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI (миграции, studio) ходит напрямую, в обход пулера: через pgbouncer миграции ломаются.
    // Не env(): он бросает без переменной, а prisma generate в postinstall должен работать и без базы.
    url: process.env.DIRECT_URL,
  },
});
