import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed. Драматические ТВ-сериалы в seed: Фрирен, «Монолог фармацевта»,
// «Реинкарнация безработного»; фильм «Твоё имя» и скрытый «Ребёнок идола» под фильтр попадать не должны.
const FILTERED = "/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&kind=tv&sort=name";
const DRAMA_TV_BY_NAME = [
  "Монолог фармацевта",
  "Провожающая в последний путь Фрирен",
  "Реинкарнация безработного: История о приключениях в другом мире. Часть 2",
];

function results(page: Page) {
  return page.getByRole("region", { name: /Найдено/ }).getByRole("listitem");
}

async function expectFilteredView(page: Page) {
  await expect(page.getByLabel("Жанр")).toHaveValue("Драма");
  await expect(page.getByLabel("Тип")).toHaveValue("tv");
  await expect(page.getByLabel("Сортировка")).toHaveValue("name");
  await expect(page.getByLabel("Год")).toHaveValue("");
  await expect(results(page)).toHaveText(DRAMA_TV_BY_NAME.map((name) => new RegExp(`^${escapeRegExp(name)}`)));
}

test("ссылка с фильтрами открывается в новой вкладке в том же виде", async ({ page, context }) => {
  await page.goto(FILTERED);
  await expectFilteredView(page);

  const tab = await context.newPage();
  await tab.goto(page.url());
  await expect(tab).toHaveURL(page.url());
  await expectFilteredView(tab);
});

test("форма меняет адрес на чистый, «Сбросить» возвращает весь каталог", async ({ page }) => {
  await page.goto("/catalog");
  await page.getByLabel("Жанр").selectOption("Драма");
  await page.getByLabel("Тип").selectOption("tv");
  await page.getByLabel("Сортировка").selectOption("name");
  await page.getByRole("button", { name: "Показать" }).click();

  // Пустые поля формы (year=, status=) в адрес не попадают: им делятся.
  await expect(page).toHaveURL(FILTERED);
  await expectFilteredView(page);

  await page.getByRole("link", { name: "Сбросить" }).click();
  await expect(page).toHaveURL("/catalog");
  await expect(page.getByLabel("Жанр")).toHaveValue("");
  await expect(results(page)).toHaveCount(8);
});

test("черновик и скрытый по жалобе тайтл не видны ни в выдаче, ни через свои фильтры", async ({ page }) => {
  await page.goto("/catalog");
  await expect(page.getByText("Семья шпиона")).toHaveCount(0);
  await expect(page.getByText("Ребёнок идола")).toHaveCount(0);
  // «Сэйнэн» в seed есть только у скрытого тайтла.
  await expect(page.getByLabel("Жанр").locator("option", { hasText: "Сэйнэн" })).toHaveCount(0);
});

test("мусор, неизвестный жанр и страница за последней ведут на чистый адрес, метки кампаний сохраняются", async ({
  page,
}) => {
  const garbage = await page.goto("/catalog?year=abc&page=-1&status=hidden&genre=%00");
  expect(garbage?.status()).toBe(200);
  await expect(page).toHaveURL("/catalog");

  // Любой текст из ?genre= не должен становиться выбранным фильтром.
  await page.goto("/catalog?genre=%D0%9A%D0%B0%D0%BA%D0%BE%D0%B9-%D1%82%D0%BE%20%D1%82%D0%B5%D0%BA%D1%81%D1%82");
  await expect(page).toHaveURL("/catalog");

  await page.goto("/catalog?kind=tv&page=40");
  await expect(page).toHaveURL("/catalog?kind=tv");

  await page.goto("/catalog?utm_source=telegram&kind=tv&foo=bar");
  await expect(page).toHaveURL("/catalog?kind=tv&utm_source=telegram");
});

test("карточка ведёт на страницу тайтла", async ({ page }) => {
  await page.goto(FILTERED);
  await expect(results(page).first().getByRole("link")).toHaveAttribute("href", "/anime/kusuriya-no-hitorigoto");
});

test("пункт «Каталог» в шапке отмечен текущим", async ({ page }) => {
  await page.goto("/catalog");
  await expect(
    page.getByRole("navigation", { name: "Разделы" }).getByRole("link", { name: "Каталог" }),
  ).toHaveAttribute("aria-current", "page");
});

test("на 360px нет горизонтального скролла", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(FILTERED);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("axe: нет нарушений critical и serious в выдаче и в пустом состоянии", async ({ page }) => {
  for (const url of [FILTERED, "/catalog?genre=%D0%9A%D0%BE%D0%BC%D0%B5%D0%B4%D0%B8%D1%8F&kind=movie"]) {
    await page.goto(url);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
    expect(blocking, url).toEqual([]);
  }
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
