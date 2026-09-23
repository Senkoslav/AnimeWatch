import { createHash } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { e2eDatabase, signInAs } from "./db";

// Настоящий Google e2e не вызывают: уход на Google проверяется по адресу редиректа, отказы возврата —
// прямыми запросами, а вошедший пользователь — сессией, подложенной в локальную базу.

const GOOGLE_ID = "e2e-google-user";
const EMAIL = "e2e-viewer@example.com";

async function signIn(context: BrowserContext, baseURL: string | undefined) {
  const { token } = await signInAs(context, baseURL, { googleId: GOOGLE_ID, email: EMAIL, name: "Тестовый зритель" });
  return token;
}

async function sessionCount(token: string) {
  const prisma = e2eDatabase();
  try {
    return await prisma.session.count({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  } finally {
    await prisma.$disconnect();
  }
}

/** Меню аккаунта: в шапке на десктопе, в нижней панели на телефоне. */
function accountMenu(page: Page, isMobile: boolean) {
  return isMobile
    ? page.getByRole("navigation", { name: "Панель разделов" }).locator("summary")
    : page.locator("header summary", { hasText: "Тестовый зритель" });
}

test("«Продолжить с Google» уводит на Google с state и PKCE и помнит, откуда пришли", async ({ request, baseURL }) => {
  const response = await request.get("/api/auth/google", {
    maxRedirects: 0,
    headers: { referer: `${baseURL}/anime/frieren` },
  });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);

  const location = new URL(response.headers().location ?? "");
  expect(location.origin).toBe("https://accounts.google.com");
  expect(location.searchParams.get("state")).toMatch(/^[\w-]{43}$/);
  expect(location.searchParams.get("code_challenge_method")).toBe("S256");
  expect(location.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);

  const cookie = response.headersArray().find(({ name, value }) => name === "set-cookie" && value.startsWith("aw_oauth="));
  expect(cookie?.value).toMatch(/HttpOnly/i);
  expect(cookie?.value).toMatch(/SameSite=Lax/i);
  expect(cookie?.value).toMatch(/Path=\/api\/auth/i);
  expect(decodeURIComponent(cookie?.value ?? "")).toContain('"returnTo":"/anime/frieren"');
});

test("возврат с чужим state и отмена на Google ведут на страницу с причиной, а не в сессию", async ({ page }) => {
  await page.goto("/api/auth/google/callback?code=x&state=forged");
  await expect(page).toHaveURL("/auth/error?reason=state");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вход устарел");

  await page.goto("/api/auth/google/callback?error=access_denied");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вход отменён");
  expect((await page.context().cookies()).some((cookie) => cookie.name === "aw_session")).toBe(false);
});

test("вошедший видит себя в меню аккаунта и выходит одной кнопкой", async ({ page, context, baseURL, isMobile }) => {
  const token = await signIn(context, baseURL);
  await page.goto("/catalog");

  const menu = accountMenu(page, isMobile);
  await menu.click();
  // Меню два — в шапке и в нижней панели, на каждой ширине видно одно.
  await expect(page.getByText(EMAIL).filter({ visible: true })).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === "critical" || impact === "serious").map(({ id }) => id)).toEqual(
    [],
  );

  await page.getByRole("button", { name: "Выйти" }).filter({ visible: true }).click();
  // Выход удаляет строку сессии: сохранённая кука больше ничего не открывает.
  await expect.poll(() => sessionCount(token)).toBe(0);
  await expect(page.getByText(EMAIL)).toHaveCount(0);
  const names = (await context.cookies()).map((cookie) => cookie.name);
  expect(names).not.toContain("aw_session");
  expect(names).not.toContain("aw_user");
});

test("«В список» у вошедшего открывает меню списков, а не вход", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL);
  await page.goto("/anime/frieren");
  const list = page.locator("details:has(button[aria-pressed]) > summary");
  // Своя отметка подгружается после загрузки страницы; пока грузится, кнопка занята.
  await expect(list).not.toHaveAttribute("aria-busy", "true");
  await list.click();
  await expect(page.getByRole("button", { name: "Смотрю", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("страница ошибки входа не индексируется, мусор в причине — общий текст", async ({ page }) => {
  await page.goto("/auth/error?reason=<script>");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Google не ответил");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
