import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { testDatabaseUrl } from "./tests/db/database-url.ts";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root("."),
      "server-only": root("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        // Чистая логика: без сети и базы, миллисекунды.
        extends: true,
        test: {
          name: "unit",
          include: ["{app,components,lib,tests/unit}/**/*.test.{ts,tsx}"],
        },
      },
      {
        // Запросы Prisma на отдельной базе: pnpm test:db, нужен локальный Postgres.
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          globalSetup: ["tests/db/global-setup.ts"],
          setupFiles: ["tests/db/setup.ts"],
          env: { DATABASE_URL: testDatabaseUrl() },
          // Тесты делят одну базу и очищают её перед каждым тестом.
          fileParallelism: false,
        },
      },
    ],
  },
});
