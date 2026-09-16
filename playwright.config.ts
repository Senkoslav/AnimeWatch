import { defineConfig, devices } from "@playwright/test";

import { E2E_CDN_HOSTNAME } from "./tests/e2e/hls-fixture.ts";

const PORT = 3100;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  // Мобильный прогон обязателен: это основной трафик (docs/07-testing.md).
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // В CI проверяем прод-сборку из отдельного шага build (docs/07, «CI»), локально — дев-сервер.
    command: isCI ? `pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    // Ненастоящие ключи Bunny: e2e никогда не ходит в живой CDN, запросы к этому хосту подменяет фикстура
    // (tests/e2e/hls-fixture.ts). Переменные процесса важнее .env.local, так что реальные ключи сюда не попадут.
    env: { BUNNY_CDN_HOSTNAME: E2E_CDN_HOSTNAME, BUNNY_TOKEN_KEY: "e2e-token-key" },
  },
});
