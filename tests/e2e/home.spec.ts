import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed: там есть опубликованные серии, черновик и скрытый тайтл.

test.beforeEach(async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
});

test("герой ведёт к просмотру последней серии, лента на месте", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");

  const hero = page.getByRole("region", { name: /./ }).first();
  await expect(hero.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Смотреть" })).toHaveAttribute("href", /^\/anime\/[^/]+\/\d+$/);

  const fresh = page.getByRole("region", { name: "Свежее" });
  await expect(fresh.getByRole("listitem").first()).toBeVisible();
  // Имя ссылки читается по частям, номер серии не слипается со временем («Эпизод 025 часов назад»).
  await expect(fresh.getByRole("link").first()).toHaveAccessibleName(/^.+, (Эпизод \d{2,}|Фильм), вышел .+$/);
});

test("черновик и скрытый по жалобе тайтл не видны", async ({ page }) => {
  // Названия из prisma/seed.ts: у обоих самые свежие серии в базе.
  await expect(page.getByText("Семья шпиона")).toHaveCount(0);
  await expect(page.getByText("Ребёнок идола")).toHaveCount(0);
});

test("на 360px нет горизонтального скролла", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  // clientWidth, а не innerWidth: на мобильном эмуляторе страница с переполнением масштабируется, и innerWidth растёт.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("с клавиатуры: ссылка «К содержанию», затем до карточек ленты, фокус виден", async ({ page, isMobile }) => {
  test.skip(isMobile, "клавиатурная навигация проверяется на десктопе");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "К содержанию" })).toBeFocused();
  await expect(page.getByRole("link", { name: "К содержанию" })).toBeInViewport();

  const fresh = page.getByRole("region", { name: "Свежее" });
  for (let step = 0; step < 20; step += 1) {
    await page.keyboard.press("Tab");
    if (await fresh.locator(":focus").count()) break;
  }
  const focused = fresh.locator(":focus");
  await expect(focused).toHaveCount(1);
  expect(await outlineOf(page)).not.toBe("none");
});

test("axe: нет нарушений уровня critical и serious", async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
  expect(blocking).toEqual([]);
});

function outlineOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    return element ? getComputedStyle(element).outlineStyle : "none";
  });
}

test("мобильное меню закрывается после перехода и не нарушает axe раскрытым", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  // Элементом, а не ролью: Chrome выставляет <summary> не как button, и роль ненадёжна.
  const menu = page.locator("header details");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);

  // Шапка живёт в рутовом лэйауте и при переходе не перемонтируется: если меню не закрыть руками,
  // оно останется раскрытым поверх новой страницы.
  await menu.getByRole("link", { name: "Каталог" }).click();
  await expect(page).toHaveURL("/catalog");
  await expect(menu).not.toHaveAttribute("open", "");
});
