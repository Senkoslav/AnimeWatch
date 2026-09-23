import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed. В seed по четвергам выходят «Дандадан» (01:23) и «Магическая битва 2»
// (17:56), по пятницам — Фрирен (23:00), по субботам — «Монолог фармацевта» (00:45). Остальные дни пусты.
// Какой день сегодня, тест не знает: разделы проверяются по якорям #day-N, «сегодня» — только первым.

test.beforeEach(async ({ page }) => {
  const response = await page.goto("/schedule");
  expect(response?.status()).toBe(200);
});

test("неделя начинается с сегодняшнего дня", async ({ page }) => {
  await expect(page.getByRole("navigation", { name: "Дни недели" }).getByRole("link").first()).toHaveText("сегодня");
  await expect(page.locator("section[id^='day-']").first().getByRole("heading", { level: 2 })).toHaveText(/^Сегодня, /);
  await expect(page.locator("section[id^='day-']")).toHaveCount(7);
});

test("день показывает только свои тайтлы, внутри дня — по времени выхода", async ({ page }) => {
  const thursday = page.locator("#day-4");
  await expect(thursday.getByRole("listitem")).toHaveCount(2);
  // Сначала ночной выход, потом вечерний: порядок по времени, а не по популярности.
  await expect(thursday.getByRole("listitem").nth(0)).toContainText("01:23");
  await expect(thursday.getByRole("listitem").nth(0)).toContainText("Дандадан");
  await expect(thursday.getByRole("listitem").nth(1)).toContainText("17:56");
  await expect(thursday).not.toContainText("Фрирен");

  await expect(page.locator("#day-5")).toContainText("Провожающая в последний путь Фрирен");
  await expect(page.locator("#day-5").getByRole("listitem")).toHaveCount(1);
});

test("пустой день говорит об этом текстом", async ({ page }) => {
  await expect(page.locator("#day-1")).toContainText("В этот день ничего не выходит.");
});

test("скрытый по жалобе тайтл в расписание не попадает", async ({ page }) => {
  await expect(page.getByText("Семья шпиона")).toHaveCount(0);
  await expect(page.getByText("Ребёнок идола")).toHaveCount(0);
});

test("якорь дня ведёт к разделу", async ({ page }) => {
  await page.locator('a[href="#day-5"]').click();
  await expect(page).toHaveURL(/#day-5$/);
  await expect(page.locator("#day-5")).toBeInViewport();
});

test("строка ведёт на страницу тайтла", async ({ page }) => {
  await page.locator("#day-5").getByRole("link").first().click();
  await expect(page).toHaveURL("/anime/frieren");
});

test("на 360px нет горизонтального скролла, axe без critical и serious", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
  expect(blocking).toEqual([]);
});

test("«Вся неделя» на главной ведёт сюда", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Расписание" }).getByRole("link", { name: "Вся неделя" }).click();
  await expect(page).toHaveURL("/schedule");
});
