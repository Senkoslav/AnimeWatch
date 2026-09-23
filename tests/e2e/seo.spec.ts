import { expect, test, type Page } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed.

async function meta(page: Page) {
  return {
    title: await page.title(),
    description: await page.locator('meta[name="description"]').getAttribute("content"),
    image: await page.locator('meta[property="og:image"]').first().getAttribute("content"),
    canonical: await page.locator('link[rel="canonical"]').getAttribute("href"),
  };
}

/** Хост сайта — тот, что в robots.txt: оба берутся из одного siteUrl(), чужого там быть не может. */
async function siteOrigin(page: Page): Promise<string> {
  const robots = await (await page.request.get("/robots.txt")).text();
  const sitemap = /^Sitemap: (\S+)$/m.exec(robots)?.[1];
  if (!sitemap) throw new Error(`в robots.txt нет Sitemap:\n${robots}`);
  return new URL(sitemap).origin;
}

test("у двух тайтлов разные заголовок, описание и картинка, canonical — на свой адрес", async ({ page }) => {
  const origin = await siteOrigin(page);

  await page.goto("/anime/frieren");
  const frieren = await meta(page);
  await page.goto("/anime/dandadan");
  const dandadan = await meta(page);

  expect(frieren.title).not.toBe(dandadan.title);
  expect(frieren.description).not.toBe(dandadan.description);
  expect(frieren.image).toBeTruthy();
  expect(frieren.image).not.toBe(dandadan.image);
  expect(frieren.canonical).toBe(`${origin}/anime/frieren`);
  expect(dandadan.canonical).toBe(`${origin}/anime/dandadan`);
});

test("canonical каждой индексируемой страницы — её собственный путь на хосте сайта", async ({ page }) => {
  const origin = await siteOrigin(page);
  for (const path of ["/", "/schedule", "/dmca", "/terms", "/privacy", "/anime/frieren/2"]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute("href", `${origin}${path === "/" ? "" : path}`);
  }
});

test("canonical каталога с отбором — чистый адрес без меток кампаний, поиск в индекс не идёт", async ({ page }) => {
  const origin = await siteOrigin(page);
  await page.goto("/catalog?kind=tv&utm_source=telegram");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${origin}/catalog?kind=tv`);

  await page.goto("/catalog?q=%D1%84%D1%80%D0%B8%D1%80%D0%B5%D0%BD");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("robots.txt закрывает редирект и поиск и указывает на карту сайта", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/^Disallow: \/random$/m);
  expect(robots).toMatch(/^Disallow: \/search$/m);
  expect(robots).toMatch(/^Sitemap: https?:\/\/[^/\s]+\/sitemap\.xml$/m);
});

test("в карте сайта — публичные тайтлы, без черновика, скрытого и страниц серий", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const xml = await response.text();

  expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/anime\/frieren<\/loc>/);
  expect(xml).not.toContain("/anime/spy-x-family");
  expect(xml).not.toContain("/anime/oshi-no-ko");
  expect(xml).not.toMatch(/\/anime\/[^<]+\/\d+<\/loc>/);
});
