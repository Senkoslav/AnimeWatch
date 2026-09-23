import { expect, test } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed: там есть черновик («Семья шпиона») и скрытый тайтл («Ребёнок идола»).

test("/random уводит на страницу публичного тайтла", async ({ page }) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await page.goto("/random");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/anime\/[^/]+$/);
    await expect(page).not.toHaveURL(/spy-x-family|oshi-no-ko/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("«Случайное» в шапке ведёт на тайтл", async ({ page, isMobile }) => {
  await page.goto("/catalog");
  if (isMobile) await page.locator("header details summary").click();
  await page.getByRole("navigation", { name: "Разделы" }).getByRole("link", { name: "Случайное" }).click();
  await expect(page).toHaveURL(/\/anime\/[^/]+$/);
});
