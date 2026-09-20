import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Ширина, с которой «Войти» стоит прямо в шапке, а не в меню. */
const HEADER_LINK = 768;

test("из шапки можно попасть на вход", async ({ page }) => {
  await page.goto("/");

  const viewport = page.viewportSize();
  if (viewport && viewport.width < HEADER_LINK) {
    // Элементом, а не ролью: Chrome выставляет <summary> не как button, и роль ненадёжна.
    await page.locator("header details summary").click();
  }

  await page.getByRole("link", { name: "Войти" }).click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вход в аккаунт");
});

test("без ключей Google кнопка говорит об этом, а не молчит", async ({ page }) => {
  await page.goto("/login");

  // Прогон идёт без GOOGLE_CLIENT_ID, значит вход обязан честно сказать, что он ещё не работает.
  await expect(page.getByRole("button", { name: "Войти через Google" })).toBeDisabled();
  await expect(page.getByText("Вход ещё подключается")).toBeVisible();

  // Регистрации отдельной нет, и страница не должна обещать её ссылкой.
  await expect(page.getByRole("link", { name: /Создать аккаунт/ })).toHaveCount(0);
});

test("страница входа не индексируется", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("на 360px нет горизонтального скролла, axe без critical и serious", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/login");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
});
