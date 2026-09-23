import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed: там есть опубликованные серии, черновик и скрытый тайтл.

test.beforeEach(async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
});

test("промо ведёт к просмотру последней серии, разделы главной на месте", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");

  const promo = page.getByRole("region").first();
  await expect(promo.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(promo.getByRole("link", { name: "Смотреть", exact: true })).toHaveAttribute(
    "href",
    /^\/anime\/[^/]+\/\d+$/,
  );

  for (const name of ["Новые серии", "Сейчас выходит", "Популярное за всё время", "Расписание"]) {
    await expect(page.getByRole("region", { name }), name).toBeVisible();
  }

  const fresh = page.getByRole("region", { name: "Новые серии" });
  await expect(fresh.getByRole("listitem").first()).toBeVisible();
  // Имя ссылки читается по частям, номер серии не слипается со временем («Эпизод 025 часов назад»).
  await expect(fresh.getByRole("listitem").first().getByRole("link")).toHaveAccessibleName(
    /^.+, (Эпизод \d{2,}|Фильм), вышел .+$/,
  );
});

test("«В список» в промо ведёт во вход", async ({ page }) => {
  await page.getByRole("region").first().getByRole("link", { name: "В список" }).click();
  await expect(page.getByRole("dialog", { name: "Вход в AnimeWatch" })).toBeVisible();
});

test("расписание переключает день без JavaScript-обработчиков: выбран сегодняшний", async ({ page }) => {
  const schedule = page.getByRole("region", { name: "Расписание" });
  await expect(schedule.getByRole("radio", { name: "сегодня" })).toBeChecked();

  // Панель переключает CSS: видна ровно одна.
  const visiblePanels = schedule.locator(".schedule-panel:visible");
  await expect(visiblePanels).toHaveCount(1);

  const other = schedule.locator("label").filter({ hasNotText: "сегодня" }).first();
  await other.click();
  await expect(other.getByRole("radio")).toBeChecked();
  await expect(visiblePanels).toHaveCount(1);
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

test("с клавиатуры: ссылка «К содержанию», затем до новых серий, фокус виден", async ({ page, isMobile }) => {
  test.skip(isMobile, "клавиатурная навигация проверяется на десктопе");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "К содержанию" })).toBeFocused();
  await expect(page.getByRole("link", { name: "К содержанию" })).toBeInViewport();

  const fresh = page.getByRole("region", { name: "Новые серии" });
  for (let step = 0; step < 30; step += 1) {
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
