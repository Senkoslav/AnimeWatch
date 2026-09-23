import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed. Redis в e2e не подключён: лимит пропускает запросы (fail-open).

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Поиск аниме" });
}

function field(page: Page) {
  return dialog(page).getByLabel("Название аниме");
}

test("Ctrl+K открывает поиск, выдача живая, стрелки и Enter ведут на тайтл", async ({ page }) => {
  await page.goto("/catalog");
  await page.keyboard.press("Control+k");
  await expect(dialog(page)).toBeVisible();
  await expect(field(page)).toBeFocused();

  await field(page).fill("фрирен");
  const first = dialog(page).getByRole("list", { name: "Найденные тайтлы" }).getByRole("link").first();
  await expect(first).toContainText("Провожающая в последний путь Фрирен");

  await field(page).press("ArrowDown");
  await expect(first).toBeFocused();
  await first.press("ArrowUp");
  await expect(field(page)).toBeFocused();

  await field(page).press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/anime/frieren");
  await expect(dialog(page)).toBeHidden();
});

test("Esc закрывает окно и возвращает фокус туда, откуда его открыли", async ({ page, isMobile }) => {
  await page.goto("/");
  const trigger = isMobile
    ? page.getByRole("banner").getByRole("link", { name: "Поиск", exact: true })
    : page.getByRole("banner").getByRole("link", { name: /Поиск аниме/ });
  await trigger.click();
  await expect(dialog(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  // Окно не перешло на /search: без JS ссылка вела бы туда, с JS — только окно.
  await expect(page).toHaveURL("/");
});

test("«/» открывает поиск, но не когда печатают в поле", async ({ page }) => {
  await page.goto("/catalog");
  await page.keyboard.press("/");
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");

  // В поле названия каталога «/» — просто символ.
  const catalogField = page.getByLabel("Название", { exact: true });
  if (await catalogField.isVisible()) {
    await catalogField.focus();
    await page.keyboard.press("/");
    await expect(dialog(page)).toBeHidden();
  }
});

test("пустая выдача зовёт в каталог, «Все результаты» ведёт на страницу поиска", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await field(page).fill("ыщвщшзхъ");
  await expect(dialog(page).getByText(/Ничего не нашлось по «ыщвщшзхъ»\. Проверьте опечатку/)).toBeVisible();
  await expect(dialog(page).getByRole("link", { name: "откройте каталог" })).toBeVisible();

  await field(page).fill("наруто");
  await dialog(page).getByRole("link", { name: /по «наруто»/ }).click();
  await expect(page).toHaveURL("/search?q=%D0%BD%D0%B0%D1%80%D1%83%D1%82%D0%BE");
});

test("открытое окно с выдачей: axe чист, на 360 без горизонтальной прокрутки", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Поиск", exact: true }).click();
  await field(page).fill("фрирен");
  await expect(dialog(page).getByRole("link", { name: /Фрирен/ }).first()).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === "critical" || impact === "serious").map(({ id }) => id)).toEqual(
    [],
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe("без JS", () => {
  test.use({ javaScriptEnabled: false });

  test("лупа и поле в шапке — обычные ссылки на страницу поиска", async ({ page, isMobile }) => {
    await page.goto("/");
    const trigger = isMobile
      ? page.getByRole("banner").getByRole("link", { name: "Поиск", exact: true })
      : page.getByRole("banner").getByRole("link", { name: /Поиск аниме/ });
    await trigger.click();
    await expect(page).toHaveURL("/search");
  });
});
