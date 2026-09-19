import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed: там есть «Наруто», «Дандадан» и черновик «Семья шпиона».

function results(page: Page) {
  return page.getByRole("region", { name: /Найдено/ }).getByRole("listitem");
}

/** Ширина, с которой в шапке поле поиска вместо лупы (md в tailwind). */
const HEADER_FIELD = 768;

/**
 * Дорога до выдачи из шапки. На широком экране поиск начинается прямо в ней, на телефоне поле
 * туда не помещается и там лупа, ведущая на страницу. Ветвимся по ширине окна, а не по видимости:
 * isVisible не ретраится и на медленном прогоне соврал бы.
 */
async function searchFromHeader(page: Page, query: string) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width >= HEADER_FIELD) {
    await page.getByLabel("Поиск аниме").fill(query);
    await page.getByLabel("Поиск аниме").press("Enter");
    return;
  }

  await page.getByRole("link", { name: "Поиск" }).click();
  await expect(page).toHaveURL("/search");
  await page.getByLabel("Название аниме").fill(query);
  await page.getByRole("button", { name: "Найти" }).click();
}

test("приёмка роадмапа: «наруот» находит «Наруто»", async ({ page }) => {
  await page.goto("/");
  await searchFromHeader(page, "наруот");

  await expect(page).toHaveURL("/search?q=%D0%BD%D0%B0%D1%80%D1%83%D0%BE%D1%82");
  await expect(results(page).first()).toContainText("Наруто");

  await results(page).first().getByRole("link").click();
  await expect(page).toHaveURL("/anime/naruto");
});

test("ищет по оригинальному названию и по синониму", async ({ page }) => {
  await page.goto("/search?q=frieren");
  await expect(results(page).first()).toContainText("Провожающая в последний путь Фрирен");

  await page.goto("/search?q=NARUTO");
  await expect(results(page).first()).toContainText("Наруто");
});

test("пустой запрос, мусор в адресе и ничего не найдено", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText("Введите название")).toBeVisible();

  // Пустое поле формы и лишние параметры уводят на чистый адрес.
  const response = await page.goto("/search?q=%20%20&foo=bar");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL("/search");

  await page.goto("/search?q=%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D1%8F");
  await expect(page.getByRole("heading", { name: "Ничего не нашлось" })).toBeVisible();
});

test("черновик не находится по своему названию", async ({ page }) => {
  // «Семья шпиона» в seed — черновик тайтла.
  await page.goto("/search?q=%D1%81%D0%B5%D0%BC%D1%8C%D1%8F%20%D1%88%D0%BF%D0%B8%D0%BE%D0%BD%D0%B0");
  await expect(page.getByText("Семья шпиона")).toHaveCount(0);
});

test("метки кампаний переживают редирект", async ({ page }) => {
  await page.goto("/search?utm_source=telegram&q=%20naruto%20");
  await expect(page).toHaveURL("/search?q=naruto&utm_source=telegram");
});

test("на 360px нет горизонтального скролла, axe без critical и serious", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const url of ["/search", "/search?q=%D0%BD%D0%B0%D1%80%D1%83%D0%BE%D1%82"]) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);

    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
    expect(blocking, url).toEqual([]);
  }
});
