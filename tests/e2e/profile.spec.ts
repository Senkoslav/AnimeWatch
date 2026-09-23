import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { e2eDatabase, signInAs } from "./db";

// Идёт на dev-базе после pnpm db:seed. У каждого теста и проекта свой зритель: прогоны параллельны.
function viewer(testInfo: TestInfo) {
  return { googleId: `e2e-profile-${testInfo.testId}`, email: "profile@example.com", name: "Зритель профиля" };
}

/** Отметки прямо в базу: профиль проверяется по тому, что лежит в Bookmark. */
async function mark(userId: string, marks: { slug: string; state: string; rating?: number }[]) {
  const prisma = e2eDatabase();
  try {
    for (const [index, { slug, state, rating }] of marks.entries()) {
      const title = await prisma.title.findUniqueOrThrow({ where: { slug }, select: { id: true } });
      await prisma.bookmark.create({
        data: {
          userId,
          titleId: title.id,
          state: state as "WATCHING" | "PLANNED" | "COMPLETED" | "DROPPED",
          rating: rating ?? null,
          // Порядок «Последнего» задаёт время правки: первая в списке — самая свежая.
          updatedAt: new Date(Date.now() - index * 60_000),
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

function listsTable(page: Page) {
  return page.getByRole("table", { name: "Отметки, которые вы поставили" });
}

test("профиль сходится с отметками: таблица списков, оценки, последнее и «продолжить»", async ({ page, baseURL }, testInfo) => {
  const { userId } = await signInAs(page.context(), baseURL, viewer(testInfo));
  await mark(userId, [
    { slug: "frieren", state: "WATCHING", rating: 9 },
    { slug: "dandadan", state: "COMPLETED", rating: 8 },
    { slug: "naruto", state: "PLANNED" },
    { slug: "jujutsu-kaisen-2", state: "DROPPED", rating: 5 },
  ]);
  await page.goto("/profile");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Зритель профиля");
  for (const name of ["Смотрю", "Запланировано", "Просмотрено", "Брошено"]) {
    const row = listsTable(page).getByRole("row", { name: new RegExp(name) });
    await expect(row).toContainText("1");
    await expect(row).toContainText("25 %");
  }
  // Кольцо называет все числа словами: цвет — не единственный носитель смысла.
  await expect(page.getByRole("img", { name: /Распределение списков: смотрю 1, запланировано 1/ })).toBeVisible();
  await expect(page.getByText("3 оценки, средняя 7,3")).toBeVisible();

  const recent = page.getByRole("region", { name: "Последнее" }).getByRole("listitem");
  await expect(recent).toHaveCount(4);
  await expect(recent.first()).toContainText("Провожающая в последний путь Фрирен");

  await page.getByRole("link", { name: "Продолжить смотреть" }).click();
  await expect(page).toHaveURL("/anime/frieren");
});

test("на 360 кольцо и таблица встают в колонку, горизонтальной прокрутки нет, axe чист", async ({ page, baseURL }, testInfo) => {
  const { userId } = await signInAs(page.context(), baseURL, viewer(testInfo));
  await mark(userId, [
    { slug: "frieren", state: "WATCHING", rating: 9 },
    { slug: "dandadan", state: "COMPLETED", rating: 8 },
  ]);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/profile");

  const ring = await page.getByRole("img", { name: /Распределение списков/ }).boundingBox();
  const table = await listsTable(page).boundingBox();
  if (!ring || !table) throw new Error("кольцо или таблица не отрисованы");
  expect(table.y).toBeGreaterThanOrEqual(ring.y + ring.height);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === "critical" || impact === "serious").map(({ id }) => id)).toEqual(
    [],
  );
});

test("пустой профиль зовёт в каталог, а не извиняется", async ({ page, baseURL }, testInfo) => {
  await signInAs(page.context(), baseURL, viewer(testInfo));
  await page.goto("/profile");
  await expect(page.getByText("Здесь появятся тайтлы, которые вы отметите")).toBeVisible();
  await page.getByRole("link", { name: "В каталог" }).first().click();
  await expect(page).toHaveURL("/catalog");
});

test("аноним на /profile видит приглашение войти, профиль не индексируется", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Профиль");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByRole("main").getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Вход в AnimeWatch" })).toBeVisible();
});

test("в меню аккаунта есть ссылка на профиль", async ({ page, baseURL, isMobile }, testInfo) => {
  await signInAs(page.context(), baseURL, viewer(testInfo));
  await page.goto("/catalog");
  const menu = isMobile
    ? page.getByRole("navigation", { name: "Панель разделов" }).locator("summary")
    : page.locator("header summary", { hasText: "Зритель профиля" });
  await menu.click();
  await page.getByRole("link", { name: "Профиль" }).filter({ visible: true }).click();
  await expect(page).toHaveURL("/profile");
});
