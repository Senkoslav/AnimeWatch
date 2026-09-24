import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { e2eDatabase, signInAs } from "./db";

// Идёт на dev-базе после pnpm db:seed: у демо-тайтлов есть настоящие «похожие» Shikimori (prisma/seed.ts).
// У каждого теста и проекта свой зритель: прогоны параллельны, а скрытия — в аккаунте.
function viewer(testInfo: TestInfo) {
  return { googleId: `e2e-recs-${testInfo.testId}`, email: "recs@example.com", name: "Зритель советов" };
}

type State = "WATCHING" | "PLANNED" | "ON_HOLD" | "COMPLETED" | "DROPPED";

async function mark(userId: string, marks: { slug: string; state: State; rating?: number }[]) {
  const prisma = e2eDatabase();
  try {
    for (const { slug, state, rating } of marks) {
      const title = await prisma.title.findUniqueOrThrow({ where: { slug }, select: { id: true } });
      await prisma.bookmark.create({ data: { userId, titleId: title.id, state, rating: rating ?? null } });
    }
  } finally {
    await prisma.$disconnect();
  }
}

/** Три положительные отметки — советы становятся личными (MIN_POSITIVE_MARKS), брошенное — минус. */
const TASTE: { slug: string; state: State; rating?: number }[] = [
  { slug: "frieren", state: "WATCHING", rating: 9 },
  { slug: "chainsaw-man", state: "COMPLETED", rating: 8 },
  { slug: "kusuriya-no-hitorigoto", state: "PLANNED" },
  { slug: "naruto", state: "DROPPED" },
];

const MUSHOKU = "Реинкарнация безработного: История о приключениях в другом мире. Часть 2";

function advice(page: Page) {
  return page.getByRole("list", { name: "Советы" }).getByRole("listitem");
}

test("вошедший видит на главной «Рекомендуем вам» с объяснением у каждого совета", async ({
  page,
  baseURL,
}, testInfo) => {
  const { userId } = await signInAs(page.context(), baseURL, viewer(testInfo));
  await mark(userId, TASTE);
  await page.goto("/");

  const row = page.getByRole("region", { name: "Рекомендуем вам" });
  const cards = row.getByRole("list", { name: "Советы для вас" }).getByRole("listitem");
  // Каталог seed: девять публичных тайтлов минус четыре отмеченных.
  await expect(cards).toHaveCount(5);
  // «Похожие» Shikimori: Реинкарнация у них первая в похожих на Фрирен, которой зритель поставил 9.
  await expect(cards.filter({ hasText: MUSHOKU })).toContainText(
    "Похоже на «Провожающая в последний путь Фрирен» — вы поставили 9",
  );
  // Уже отмеченное не советуется, брошенное тоже. Карточка ищется по адресу: имя ссылки — вся карточка.
  for (const { slug } of TASTE) {
    await expect(row.locator(`a[href="/anime/${slug}"]`)).toHaveCount(0);
  }

  await row.getByRole("link", { name: "Все рекомендации" }).click();
  await expect(page).toHaveURL("/recommendations");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Рекомендации");
});

test("«Не интересно» переживает перезагрузку, а «Вернуть» возвращает совет", async ({ page, baseURL }, testInfo) => {
  const { userId } = await signInAs(page.context(), baseURL, viewer(testInfo));
  await mark(userId, TASTE);
  await page.goto("/recommendations");
  await expect(advice(page)).toHaveCount(5);

  // Скрыть и сразу вернуть: фокус ходит между кнопками, а не падает в начало страницы.
  await page.getByRole("button", { name: "Не интересно: «Дандадан»" }).click();
  await expect(page.getByText("«Дандадан» больше не советуем")).toBeVisible();
  const restore = page.getByRole("button", { name: "Вернуть" });
  await expect(restore).toBeFocused();
  await expect(restore).toBeEnabled();
  await restore.click();
  await expect(page.getByRole("button", { name: "Не интересно: «Дандадан»" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Не интересно: «Дандадан»" })).toBeEnabled();

  // Скрыть насовсем: после перезагрузки совета нет, а вернувшийся на месте.
  await page.getByRole("button", { name: `Не интересно: «${MUSHOKU}»` }).click();
  await expect(page.getByRole("button", { name: "Вернуть" })).toBeEnabled();
  await page.reload();
  await expect(advice(page)).toHaveCount(4);
  await expect(page.locator('main a[href="/anime/mushoku-tensei-part-2"]')).toHaveCount(0);
  await expect(page.locator('main a[href="/anime/dandadan"]')).toBeVisible();

  // Скрытие лежит в аккаунте: другое устройство его тоже не видит.
  const other = await page.context().browser()!.newContext();
  try {
    await signInAs(other, baseURL, viewer(testInfo));
    const second = await other.newPage();
    await second.goto("/recommendations");
    await expect(advice(second)).toHaveCount(4);
    await expect(second.locator('main a[href="/anime/mushoku-tensei-part-2"]')).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("мало отметок: на главной приглашение отметить тайтлы, а не чужое «популярное»", async ({
  page,
  baseURL,
}, testInfo) => {
  const { userId } = await signInAs(page.context(), baseURL, viewer(testInfo));
  await mark(userId, [{ slug: "frieren", state: "WATCHING" }]);
  await page.goto("/");

  const row = page.getByRole("region", { name: "Рекомендуем вам" });
  await expect(row.getByText("Отметьте три тайтла — и здесь появятся советы именно для вас")).toBeVisible();
  await row.getByRole("link", { name: "В каталог" }).click();
  await expect(page).toHaveURL("/catalog");
});

test("аноним: на главной ряда нет, на странице — популярное и приглашение войти", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Популярное" }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Рекомендуем вам" })).toHaveCount(0);

  await page.goto("/recommendations");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Это популярное с высокой оценкой")).toBeVisible();
  await expect(advice(page).first()).toContainText(/Оценка Shikimori|Популярно на Shikimori/);
  // Скрытие хранится в аккаунте — без входа его нет, а не молчащая кнопка.
  await expect(page.getByRole("button", { name: /Не интересно/ })).toHaveCount(0);
  await page.getByRole("main").getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Вход в AnimeWatch" })).toBeVisible();
});

test("на 360 советы без горизонтальной прокрутки, axe чист на странице и на главной", async ({
  page,
  baseURL,
}, testInfo) => {
  const { userId } = await signInAs(page.context(), baseURL, viewer(testInfo));
  await mark(userId, TASTE);
  await page.setViewportSize({ width: 360, height: 800 });

  for (const path of ["/recommendations", "/"]) {
    await page.goto(path);
    await expect(page.getByText("Похоже на «Провожающая в последний путь Фрирен» — вы поставили 9")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(
      violations.filter(({ impact }) => impact === "critical" || impact === "serious").map(({ id }) => id),
      path,
    ).toEqual([]);
  }

  // Скрытый совет на телефоне тоже не выходит за свою колонку.
  await page.goto("/recommendations");
  await page.getByRole("button", { name: `Не интересно: «${MUSHOKU}»` }).click();
  const placeholder = page.getByText(`«${MUSHOKU}» больше не советуем`);
  await expect(placeholder).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
