import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * «Войти» стоит в шапке на широком экране и в нижней панели на телефоне; на каждой ширине видим ровно
 * одна из них, поэтому роль с именем однозначна в обоих прогонах. Отдельной страницы входа нет
 * (решение владельца 2026-09-23): вход — только окно.
 */
function loginTrigger(page: Page) {
  return page.getByRole("button", { name: "Войти" });
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

test("«Войти» открывает окно поверх каталога, адрес не меняется", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();

  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL("/catalog");
  await expect(page.getByRole("heading", { level: 1, name: "Каталог" })).toBeAttached();
});

test("Esc закрывает окно и возвращает фокус на «Войти»", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();
  await expect(dialog(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(loginTrigger(page)).toBeFocused();
});

test("крестик закрывает окно на странице тайтла", async ({ page }) => {
  await page.goto("/anime/frieren");
  await loginTrigger(page).click();
  await expect(dialog(page)).toBeVisible();

  await dialog(page).getByRole("button", { name: "Закрыть" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL("/anime/frieren");
});

test("нажатие мимо окна закрывает его", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();
  await openedDialog(page);

  // Левый верхний угол — затемнение под окном, а не само окно.
  await page.mouse.click(4, 4);
  await expect(dialog(page)).toBeHidden();
});

test("«В список» тоже открывает окно входа", async ({ page }) => {
  await page.goto("/anime/frieren");
  await page.getByRole("button", { name: "В список" }).first().click();
  await expect(dialog(page)).toBeVisible();
});

test("ссылка на соглашение из окна уводит на страницу соглашения", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();
  await dialog(page).getByRole("link", { name: "пользовательским соглашением" }).click();

  await expect(page).toHaveURL("/terms");
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Пользовательское соглашение");
});

test("с ключами Google кнопка — обычная ссылка на вход, работающая без JS", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();

  // Прогон идёт с тестовыми ключами (playwright.config.ts). Состояние без ключей проверяет googleConfig() в unit.
  await expect(dialog(page).getByRole("link", { name: "Продолжить с Google" })).toHaveAttribute(
    "href",
    "/api/auth/google",
  );
  await expect(dialog(page).getByText("Вход ещё подключается")).toHaveCount(0);
  await expect(dialog(page).getByRole("link", { name: /отдельной страницей/ })).toHaveCount(0);
});

test("страницы /login нет", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(404);
});

test("axe: открытое окно без нарушений critical и serious", async ({ page }) => {
  await page.goto("/catalog");
  await loginTrigger(page).click();
  await openedDialog(page);

  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
  expect(blocking).toEqual([]);
});

test.describe("без JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("окно открывается нативной командой кнопки", async ({ page }) => {
    await page.goto("/catalog");
    await loginTrigger(page).click();
    await expect(dialog(page)).toBeVisible();
  });
});
