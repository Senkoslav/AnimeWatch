import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Уведомление в телеграм в тестах не настроено: обращение всё равно принимается, это проверяется здесь же.
async function fill(page: Page, overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    "Ваше имя или организация": "Ирина Правова",
    "Адрес для ответа": "legal@example.com",
    Правообладатель: "ООО «Правообладатель»",
    "Ссылка на страницу": "https://animewatch.ru/anime/frieren",
    "Суть обращения": "Материал размещён без разрешения, просим скрыть тайтл целиком.",
    ...overrides,
  };
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
}

test("обращение отправляется и показывает подтверждение", async ({ page }) => {
  await page.goto("/dmca");
  await fill(page);
  await page.getByRole("checkbox", { name: /Подтверждаю/ }).check();
  await page.getByRole("button", { name: "Отправить обращение" }).click();

  await expect(page.getByRole("status")).toContainText("Обращение принято");
});

test("ошибка в поле называет поле и сохраняет введённое", async ({ page }) => {
  await page.goto("/dmca");
  await fill(page, { "Адрес для ответа": "не почта" });
  await page.getByRole("checkbox", { name: /Подтверждаю/ }).check();
  await page.getByRole("button", { name: "Отправить обращение" }).click();

  await expect(page.getByText("Проверьте адрес: на него придёт наш ответ")).toBeVisible();
  // Остальное не потерялось: перепечатывать обращение заново не нужно.
  await expect(page.getByLabel("Суть обращения", { exact: true })).toHaveValue(/Материал размещён/);
});

test("без подтверждения достоверности обращение не уходит", async ({ page }) => {
  await page.goto("/dmca");
  await fill(page);
  await page.getByRole("button", { name: "Отправить обращение" }).click();

  await expect(page.getByText("Подтвердите, что сведения достоверны")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("ссылка на обращение есть в футере любой страницы", async ({ page }) => {
  for (const url of ["/", "/catalog", "/anime/frieren"]) {
    await page.goto(url);
    await expect(
      page
        .getByRole("navigation", { name: "Правовая информация" })
        .getByRole("link", { name: "Обращение правообладателя" }),
      url,
    ).toBeVisible();
  }
});

test("на 360px нет горизонтального скролла, axe без critical и serious", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const url of ["/dmca", "/terms", "/privacy"]) {
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
