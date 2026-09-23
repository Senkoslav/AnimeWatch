import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed: у Фрирен три серии с демо-источником, у «Дан да дан» источника нет.
const WITH_SOURCE = "/anime/frieren/1";
const WITHOUT_SOURCE = "/anime/dandadan/1";

/** Фрейм поставщика в тестах не загружается: в живой Kodik e2e не ходит никогда (docs/07). */
async function stubProvider(page: import("@playwright/test").Page) {
  await page.route(/kodik\.(info|biz|cc)|aniqit\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>плеер поставщика</body></html>" }),
  );
}

test("серия с источником показывает фрейм поставщика", async ({ page }) => {
  await stubProvider(page);
  await page.goto(WITH_SOURCE);

  const frame = page.locator("iframe");
  await expect(frame).toHaveAttribute("src", /^https:\/\/kodik\.info\//);
  await expect(frame).toHaveAttribute("allowfullscreen", "");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Эпизод 01");
});

test("серия без источника: понятное состояние вместо пустого экрана", async ({ page }) => {
  await page.goto(WITHOUT_SOURCE);

  await expect(page.getByText("Источник для этой серии ещё не подключён")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  // Страница остаётся рабочей: список серий и навигация на месте.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Эпизод 01");
});

test("переходы между сериями и возврат на страницу тайтла", async ({ page }) => {
  await stubProvider(page);
  await page.goto(WITH_SOURCE);

  await page.getByRole("link", { name: "Следующая" }).click();
  await expect(page).toHaveURL("/anime/frieren/2");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Эпизод 02");

  await page.getByRole("link", { name: "Предыдущая" }).click();
  await expect(page).toHaveURL(WITH_SOURCE);

  await page.getByRole("link", { name: "Провожающая в последний путь Фрирен" }).first().click();
  await expect(page).toHaveURL("/anime/frieren");
});

test("серии рядом с плеером — плитки с номером, текущая отмечена, черновика нет", async ({ page }) => {
  await stubProvider(page);
  await page.goto("/anime/frieren/2");

  const tiles = page.getByRole("region", { name: "Серии" }).getByRole("listitem");
  // Четвёртая серия — черновик: плитки у неё нет.
  await expect(tiles).toHaveCount(3);

  const current = page.getByRole("link", { name: /^Эпизод 02, .*играет сейчас/ });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(current).toHaveText("02");

  // Двузначная плитка — квадрат не меньше тач-цели, все плитки одной ширины.
  const box = await current.boundingBox();
  if (!box) throw new Error("плитка не отрисована");
  expect(Math.round(box.width)).toBe(Math.round(box.height));
  expect(box.height).toBeGreaterThanOrEqual(44);
  const widths = await tiles.getByRole("link").evaluateAll((links) => links.map((link) => link.clientWidth));
  expect(new Set(widths).size).toBe(1);

  // Название серии не теряется: оно в подписи ссылки. Свежая серия помечена и словом.
  await expect(page.getByRole("link", { name: "Эпизод 03, Магия убийства людей, новая" })).toBeVisible();

  await page.getByRole("link", { name: /^Эпизод 01,/ }).click();
  await expect(page).toHaveURL("/anime/frieren/1");
  await expect(page.getByRole("link", { name: /^Эпизод 01, .*играет сейчас/ })).toHaveAttribute("aria-current", "page");
});

test("черновик серии и скрытый тайтл на просмотре — 404", async ({ page }) => {
  for (const url of ["/anime/frieren/4", "/anime/spy-x-family/1", "/anime/frieren/999"]) {
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(404);
  }
});

test("на 360px нет горизонтального скролла, axe без critical и serious", async ({ page }) => {
  await stubProvider(page);
  await page.setViewportSize({ width: 360, height: 800 });

  for (const url of [WITH_SOURCE, WITHOUT_SOURCE]) {
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
