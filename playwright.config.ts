import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  // Убирает следы прошлых прогонов: без этого лимит обращений на /dmca роняет тест по истории запусков.
  globalSetup: "./tests/e2e/global-setup.ts",
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
    // Тестовые ключи Google: вход включён, но настоящий Google e2e не вызывают никогда —
    // уход на Google проверяется по адресу редиректа, а сессия подкладывается в базу (auth.spec.ts).
    env: { GOOGLE_CLIENT_ID: "e2e-client.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "e2e-secret" },
  },
});
