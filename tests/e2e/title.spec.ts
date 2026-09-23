import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed: у Фрирен три опубликованные серии и черновик четвёртой.
const FRIEREN = "/anime/frieren";

test("страница рендерится на сервере: в сыром HTML весь контент, черновой серии нет", async ({ request }) => {
  const response = await request.get(FRIEREN);
  expect(response.status()).toBe(200);
  const html = await response.text();

  for (const text of [
    "Провожающая в последний путь Фрирен",
    "Sousou no Frieren",
    // Описание целиком, включая то, что визуально скрыто под «Читать дальше».
    "Отряд героя победил Короля демонов и вернулся домой. Эльфийка-маг Фрирен проживёт ещё тысячу лет и только теперь начинает понимать, как мало времени провела со спутниками. Она отправляется в новое путешествие, чтобы узнать людей, которых успела потерять, и берёт в ученицы юную волшебницу Ферн.",
    "Конец путешествия",
    "Не обязательно магия",
    "Магия убийства людей",
    "Драма",
  ]) {
    expect(html, text).toContain(text);
  }
  expect(html).not.toContain("Земля, где покоятся души");
});

test("черновик, скрытый по жалобе и несуществующий тайтл — 404 с одинаковым текстом", async ({ page }) => {
  for (const url of ["/anime/oshi-no-ko", "/anime/spy-x-family", "/anime/net-takogo", "/anime/%00"]) {
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Такой страницы нет");
  }
});

test("жанр ведёт в каталог с этим фильтром, «Смотреть» — к первой серии", async ({ page }) => {
  await page.goto(FRIEREN);
  await expect(page.getByRole("link", { name: "Смотреть" })).toHaveAttribute("href", "/anime/frieren/1");

  await page.getByRole("list", { name: "Жанры" }).getByRole("link", { name: "Драма" }).click();
  await expect(page).toHaveURL("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0");
  // Отбор виден и при закрытом листе: метка над выдачей говорит, почему тайтлов стало меньше.
  await expect(page.getByRole("list", { name: "Действующий отбор" })).toContainText("Драма");
});

test("из каталога карточка открывает страницу тайтла", async ({ page }) => {
  await page.goto("/catalog?sort=name");
  await page.getByRole("link", { name: /Провожающая в последний путь Фрирен/ }).click();
  await expect(page).toHaveURL(FRIEREN);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Провожающая в последний путь Фрирен");
});

test("список серий: номер, название и длительность читаются по частям", async ({ page }) => {
  await page.goto(FRIEREN);
  const episodes = page.getByRole("region", { name: /Серии/ }).getByRole("listitem");
  await expect(episodes).toHaveCount(3);
  await expect(episodes.first().getByRole("link")).toHaveAccessibleName(
    "Эпизод 01, Конец путешествия, длительность 24:30",
  );
});

test("«Читать дальше» раскрывает длинное описание с клавиатуры", async ({ page, isMobile }) => {
  test.skip(isMobile, "клавиатура проверяется на десктопе");
  // Описание Фрирен в seed длиннее порога.
  await page.goto(FRIEREN);
  const toggle = page.getByRole("button", { name: "Читать дальше" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const description = page.locator(`#${await toggle.getAttribute("aria-controls")}`.replaceAll(":", "\\:"));
  const clampedHeight = (await description.boundingBox())?.height ?? 0;

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Свернуть" })).toHaveAttribute("aria-expanded", "true");
  expect((await description.boundingBox())?.height ?? 0).toBeGreaterThan(clampedHeight);
});

test("на 360px нет горизонтального скролла, axe без critical и serious", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const url of [FRIEREN, "/anime/kimi-no-na-wa", "/anime/net-takogo"]) {
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

test("«В список» без аккаунта ведёт во вход, а не молчит", async ({ page }) => {
  await page.goto(FRIEREN);
  await page.getByRole("button", { name: "В список" }).click();

  await expect(page.getByRole("dialog", { name: "Вход в AnimeWatch" })).toBeVisible();
  // Страница тайтла осталась под окном: адрес прежний, заголовок тайтла на месте.
  await expect(page).toHaveURL("/anime/frieren");
  await expect(page.getByRole("heading", { level: 1, name: "Провожающая в последний путь Фрирен" })).toBeAttached();
});
