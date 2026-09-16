import { expect, test } from "@playwright/test";

test("главная открывается на русском", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("на 360px нет горизонтального скролла", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  // clientWidth, а не innerWidth: на мобильном эмуляторе страница с переполнением масштабируется, и innerWidth растёт вместе с ней.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
