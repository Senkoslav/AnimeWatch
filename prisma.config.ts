import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 сам .env не читает. Локально переменные в .env.local (как у Next), на Vercel и в CI — в окружении.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

/**
 * Прямое соединение для CLI. На превью Vercel — только ветка базы, которую для этого превью создала
 * интеграция Neon (`DATABASE_URL_UNPOOLED`): старый `DIRECT_URL` в окружении превью указывает на
 * боевую базу, и миграция с недоделанной ветки ушла бы в прод. Нет ветки — нет адреса, и
 * scripts/vercel-build.sh миграции пропускает. Везде ещё — `DIRECT_URL`, а без него адрес интеграции.
 */
const directUrl =
  process.env.VERCEL_ENV === "preview"
    ? process.env.DATABASE_URL_UNPOOLED
    : (process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI (миграции, studio) ходит напрямую, в обход пулера: через pgbouncer миграции ломаются.
    // Не env(): он бросает без переменной, а prisma generate в postinstall должен работать и без базы.
    url: directUrl,
    // Пустая база для «примерки» миграций: нужна `migrate dev` и обязательна для
    // `migrate diff --from-migrations`, которым генерируются миграции с потерей данных
    // (`migrate dev` для них требует интерактивного подтверждения).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
