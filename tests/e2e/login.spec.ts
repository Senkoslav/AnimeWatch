import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * «Войти» стоит в шапке на широком экране и в нижней панели на телефоне; на каждой ширине видим ровно
 * один из них, поэтому роль с именем однозначна в обоих прогонах.
 */
function loginTrigger(page: Page) {
  return page.getByRole("link", { name: "Войти" });
}

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Вход в AnimeWatch" });
}

/**
 * Окно проявляется за 180 мс. Контраст меряется по окну в покое: посреди проявления текст ещё
 * полупрозрачный, и axe снял бы нарушение, которого зритель не увидит.
 */
async function openedDialog(page: Page) {
  await expect(dialog(page)).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState === "finished"));
}

test("«Войти» открывает модалку поверх каталога, а не уводит на страницу", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();

  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL("/login");
  // Страница под модалкой осталась прежней: заголовок каталога на месте.
  await expect(page.getByRole("heading", { level: 1, name: "Каталог" })).toBeAttached();
});

test("Esc закрывает модалку, возвращает адрес и фокус на «Войти»", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();
  await expect(dialog(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page).toHaveURL("/catalog");
  await expect(loginTrigger(page)).toBeFocused();
});

test("крестик закрывает модалку со страницы тайтла", async ({ page }) => {
  await page.goto("/anime/frieren");
  await loginTrigger(page).click();
  await expect(dialog(page)).toBeVisible();

  await dialog(page).getByRole("button", { name: "Закрыть" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page).toHaveURL("/anime/frieren");
});

test("ссылка на соглашение из модалки закрывает её и открывает страницу", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();
  await dialog(page).getByRole("link", { name: "пользовательским соглашением" }).click();

  await expect(page).toHaveURL("/terms");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Пользовательское соглашение");
});

test("прямой заход на /login — страница с той же карточкой, без модалки", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вход в AnimeWatch");
  // Ссылка «отдельной страницей» на самой странице вела бы на себя.
  await expect(page.getByRole("link", { name: "Открыть отдельной страницей" })).toHaveCount(0);
});

test("без ключей Google кнопка говорит об этом, а не молчит", async ({ page }) => {
  await page.goto("/login");

  // Прогон идёт без GOOGLE_CLIENT_ID, значит вход обязан честно сказать, что он ещё не работает.
  await expect(page.getByRole("button", { name: "Продолжить с Google" })).toBeDisabled();
  await expect(page.getByText("Вход ещё подключается")).toBeVisible();

  // Регистрации отдельной нет, и страница не должна обещать её ссылкой.
  await expect(page.getByRole("link", { name: /Создать аккаунт/ })).toHaveCount(0);
});

test("страница входа не индексируется", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("axe: открытая модалка без нарушений critical и serious", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();
  await openedDialog(page);

  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
  expect(blocking).toEqual([]);
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

test.describe("без JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("«Войти» ведёт на страницу входа", async ({ page }) => {
    await page.goto("/catalog");
    await loginTrigger(page).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вход в AnimeWatch");
  });
});
