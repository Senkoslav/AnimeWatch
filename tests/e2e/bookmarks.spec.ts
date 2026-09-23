import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { signInAs } from "./db";

// Идёт на dev-базе после pnpm db:seed. У каждого проекта свой зритель: десктоп и телефон идут
// параллельно и иначе переставляли бы отметки друг другу.
function viewer(testInfo: TestInfo) {
  return {
    googleId: `e2e-bookmarks-${testInfo.testId}`,
    email: `bookmarks-${testInfo.project.name}@example.com`,
    name: "Зритель со списками",
  };
}

/**
 * Кнопка списков на странице тайтла: summary того <details>, где лежат пункты-переключатели. Своя
 * отметка подгружается после загрузки страницы; пока она грузится, кнопка занята (aria-busy).
 */
function listButton(page: Page) {
  return page.locator("details:has(button[aria-pressed]) > summary");
}

async function readyListButton(page: Page) {
  const button = listButton(page);
  await expect(button).not.toHaveAttribute("aria-busy", "true");
  return button;
}

async function chooseList(page: Page, label: string) {
  await (await readyListButton(page)).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(listButton(page)).toContainText(label);
}

test("отметка и оценка переживают смену устройства и видны значком в каталоге", async ({ page, browser, baseURL }, testInfo) => {
  const who = viewer(testInfo);
  await signInAs(page.context(), baseURL, who);
  await page.goto("/anime/frieren");

  await expect(listButton(page)).toContainText("В список");
  await chooseList(page, "Смотрю");
  await page.getByRole("button", { name: "Оценка 8" }).click();
  await expect(page.getByRole("button", { name: "Оценка 8" })).toHaveAttribute("aria-pressed", "true");

  // «Другое устройство»: новый браузерный контекст и своя сессия того же пользователя.
  const other = await browser.newContext({ baseURL });
  await signInAs(other, baseURL, who);
  const phone = await other.newPage();
  await phone.goto("/anime/frieren");
  await expect(listButton(phone)).toContainText("Смотрю");
  await expect(phone.getByRole("button", { name: "Оценка 8" })).toHaveAttribute("aria-pressed", "true");

  await phone.goto("/catalog");
  await expect(
    phone.getByRole("list", { name: "Найденные тайтлы" }).getByRole("listitem").filter({ hasText: "Фрирен" }),
  ).toContainText("смотрю");
  await other.close();
});

test("оценка тайтла вне списков кладёт его в «Просмотрено» и говорит об этом", async ({ page, baseURL }, testInfo) => {
  await signInAs(page.context(), baseURL, viewer(testInfo));
  await page.goto("/anime/dandadan");

  await expect(listButton(page)).toContainText("В список");
  await page.getByRole("button", { name: "Оценка 7" }).click();
  await expect(page.getByText("Добавлено в «Просмотрено».")).toBeVisible();
  await expect(listButton(page)).toContainText("Просмотрено");

  // «Убрать из списка» снимает и оценку.
  await (await readyListButton(page)).click();
  await page.getByRole("button", { name: "Убрать из списка и снять оценку" }).click();
  await expect(listButton(page)).toContainText("В список");
  await expect(page.getByRole("button", { name: "Оценка 7" })).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(listButton(page)).toContainText("В список");
});

test("аноним: «В список» и «Оценить» зовут войти, а не молчат", async ({ page }) => {
  await page.goto("/anime/frieren");
  await page.getByRole("button", { name: "В список" }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Вход в AnimeWatch" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Оценить" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Вход в AnimeWatch" })).toBeVisible();
});

test("открытое меню списков: axe чист, на 360 нет горизонтальной прокрутки", async ({ page, baseURL }, testInfo) => {
  await signInAs(page.context(), baseURL, viewer(testInfo));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/anime/frieren");
  await (await readyListButton(page)).click();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === "critical" || impact === "serious").map(({ id }) => id)).toEqual(
    [],
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
