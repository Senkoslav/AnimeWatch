import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

import { stubCdn, type CdnStub } from "./hls-fixture";

// CDN подменён фикстурой в каждом тесте этого файла; тест может настроить отказы через cdn.reject.
const test = base.extend<{ cdn: CdnStub }>({
  cdn: [
    async ({ page }, use) => {
      await use(await stubCdn(page));
    },
    { auto: true },
  ],
});

// Chromium из Playwright не декодирует H.264, а Bunny отдаёт именно его: плеер проверяем в Chrome.
test.use({ channel: "chrome" });

// Идёт на dev-базе после pnpm db:seed: у Фрирен серии 1–3 с видео, у «Кайдзю №8» вторая серия без видео.

function video(page: Page) {
  return page.locator("video");
}

async function currentTime(page: Page): Promise<number> {
  return video(page).evaluate((element: HTMLVideoElement) => element.currentTime);
}

async function waitForTime(page: Page, predicate: (time: number) => boolean, message: string, timeout = 15_000) {
  await expect.poll(async () => predicate(await currentTime(page)), { message, timeout }).toBe(true);
}

async function isPaused(page: Page): Promise<boolean> {
  return video(page).evaluate((element: HTMLVideoElement) => element.paused);
}

test("приёмка: старт, перемотка, конец серии и автопереход к следующей", async ({ page }) => {
  await page.goto("/anime/frieren/2");
  await page.getByRole("button", { name: "Воспроизвести" }).click();
  await waitForTime(page, (time) => time > 0.5, "время должно пойти после Play");

  // Перемотка шкалой с клавиатуры: End уводит в конец серии.
  const slider = page.getByRole("slider", { name: "Перемотка" });
  await slider.focus();
  await page.keyboard.press("End");
  await waitForTime(page, (time) => time > 6, "перемотка в конец должна сменить позицию");

  const overlay = page.getByRole("status").filter({ hasText: "Эпизод 03 через" });
  await expect(overlay).toBeVisible({ timeout: 15_000 });
  // Отсчёт идёт сам: не нажимаем ничего и ждём переход.
  await expect(page).toHaveURL("/anime/frieren/3", { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Эпизод 03");
  await waitForTime(page, (time) => time > 0.5, "следующая серия должна стартовать сама");
});

test("«Отмена» останавливает автопереход", async ({ page }) => {
  await page.goto("/anime/frieren/2");
  await page.getByRole("button", { name: "Воспроизвести" }).click();
  await waitForTime(page, (time) => time > 0.3, "время должно пойти");
  await page.getByRole("slider", { name: "Перемотка" }).focus();
  await page.keyboard.press("End");

  await page.getByRole("button", { name: "Отмена" }).click({ timeout: 15_000 });
  await page.waitForTimeout(6_000);
  await expect(page).toHaveURL("/anime/frieren/2");
});

test("клавиатура целиком: Tab до плеера, пауза, перемотка, громкость, скорость и качество", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "клавиатура проверяется на десктопе");
  await page.goto("/anime/frieren/1");

  const play = page.getByRole("button", { name: "Воспроизвести" });
  for (let step = 0; step < 15 && !(await play.evaluate((element) => element === document.activeElement)); step += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(play).toBeFocused();

  await page.keyboard.press("Space");
  await waitForTime(page, (time) => time > 0.3, "Space должен запустить серию");
  await page.keyboard.press("k");
  await expect.poll(() => isPaused(page)).toBe(true);

  const before = await currentTime(page);
  await page.keyboard.press("ArrowRight");
  await waitForTime(page, (time) => time >= before + 4, "стрелка вправо перематывает на 5 секунд");

  await page.keyboard.press("m");
  await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);

  // Меню скорости: открыть с клавиатуры, выбрать 1,5×.
  const speed = page.getByRole("button", { name: /^Скорость/ });
  await speed.focus();
  await page.keyboard.press("Enter");
  const fast = page.getByRole("menuitemradio", { name: "1,5×" });
  await fast.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.playbackRate)).toBe(1.5);
  // Закрываясь, меню возвращает фокус на свою кнопку: ждём, иначе оно перебьёт фокус следующего шага.
  await expect(page.getByRole("button", { name: "Скорость: 1,5×" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Скорость: 1,5×" })).toBeFocused();

  // Меню качества: выбрать 240p с клавиатуры и увидеть выбор при следующем открытии.
  // (На паузе ручное качество применяется к следующим сегментам, поэтому проверяем выбор, а не высоту кадра.)
  const quality = page.getByRole("button", { name: "Качество" });
  await page.keyboard.press("Shift+Tab");
  await expect(quality).toBeFocused();
  await page.keyboard.press("Enter");
  const low = page.getByRole("menuitemradio", { name: "240p" });
  await low.focus();
  await page.keyboard.press("Enter");
  await expect(quality).toHaveAttribute("aria-expanded", "false");
  await expect(quality).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemradio", { name: /240p/ })).toHaveAttribute("aria-checked", "true");

  // Конец серии и переход к следующей — тоже с клавиатуры.
  await page.keyboard.press("Escape");
  // End на шкале ставит позицию в конец: серия закончена и на паузе, Space здесь запустил бы её заново.
  await page.getByRole("slider", { name: "Перемотка" }).focus();
  await page.keyboard.press("End");
  const watchNow = page.getByRole("button", { name: "Смотреть сейчас" });
  await expect(watchNow).toBeVisible({ timeout: 15_000 });
  for (
    let step = 0;
    step < 25 && !(await watchNow.evaluate((element) => element === document.activeElement));
    step += 1
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(watchNow).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/anime/frieren/2");
});

test("позиция восстанавливается после перезагрузки вкладки", async ({ page }) => {
  await page.goto("/anime/frieren/1");
  await page.getByRole("button", { name: "Воспроизвести" }).click();
  await waitForTime(page, (time) => time > 3, "дождаться середины");
  await page.getByRole("button", { name: "Приостановить" }).click();
  const saved = await currentTime(page);

  await page.reload();
  await waitForTime(page, (time) => Math.abs(time - saved) < 1.5, "после перезагрузки позиция на месте");
});

test("протухший токен: CDN отвечает 403, плеер берёт свежий URL и играет дальше", async ({ page, cdn }) => {
  // Токен страницы «протух» со второго сегмента: первые 2 секунды играют, дальше CDN отвечает 403.
  // hls.js сдаётся не сразу, а после своих повторов — к этому времени свежая подпись уже отличается (срок в секундах).
  cdn.reject = (token, file) => token === cdn.tokens[0] && /video[1-9]\.ts$/.test(file);
  // Срок в подписи — в секундах: если hls.js сдастся быстро, свежий URL из API совпадёт с выданным страницей.
  // В жизни токен протухает через часы и всегда отличается; в тесте гарантируем секунду между подписями.
  cdn.firstRejectDelayMs = 1_100;
  // Зритель раньше выбрал 1,5×: перезагрузка источника не должна сбросить скорость.
  await page.addInitScript(() => window.localStorage.setItem("bebradub:player", JSON.stringify({ playbackRate: 1.5 })));
  const refreshed = page.waitForResponse((response) => response.url().includes("/api/playback/"), { timeout: 25_000 });

  await page.goto("/anime/frieren/1");
  await page.getByRole("button", { name: "Воспроизвести" }).click();

  expect((await refreshed).status()).toBe(200);
  await expect.poll(() => cdn.tokens.length, { message: "запросы пошли со свежим токеном" }).toBeGreaterThan(1);
  // Дальше первого сегмента можно уйти только со свежим токеном; играло до ошибки — играет и после.
  await waitForTime(page, (time) => time > 3, "после обновления ссылки серия играет дальше");
  expect(await video(page).evaluate((element: HTMLVideoElement) => element.playbackRate)).toBe(1.5);
  // Не getByRole("alert") целиком: объявитель маршрута Next.js тоже alert.
  await expect(page.getByText("Не удалось загрузить серию")).toHaveCount(0);
});

test("настоящий отказ: после неудачного обновления — понятная ошибка и «Попробовать снова»", async ({ page, cdn }) => {
  // Долгий сценарий по устройству: повторы hls.js (~8 с), одно обновление ссылки, снова повторы — и только потом ошибка.
  test.setTimeout(90_000);
  cdn.reject = (_token, file) => /video[1-9]\.ts$/.test(file);
  await page.goto("/anime/frieren/1");
  await page.getByRole("button", { name: "Воспроизвести" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "Не удалось загрузить серию" });
  await expect(alert).toBeVisible({ timeout: 60_000 });
  await expect(alert.getByRole("button", { name: "Попробовать снова" })).toBeVisible();
});

test("подписи плеера русские уже в серверном HTML", async ({ request }) => {
  const html = await (await request.get("/anime/frieren/1")).text();
  expect(html).toContain('aria-label="Воспроизвести"');
  expect(html).not.toContain('aria-label="Play"');
});

test("опубликованная серия без видео, черновик и мусор в адресе", async ({ page, request }) => {
  await page.goto("/anime/kaiju-no-8/2");
  await expect(page.getByText("Серия ещё обрабатывается, обычно это занимает 10–15 минут.")).toBeVisible();

  for (const url of ["/anime/frieren/4", "/anime/frieren/01", "/anime/frieren/0", "/anime/oshi-no-ko/1"]) {
    expect((await page.goto(url))?.status(), url).toBe(404);
  }
  expect((await request.get("/api/playback/%00")).status()).toBe(404);
  expect((await request.get("/api/playback/cknotarealepisodeid00000")).status()).toBe(404);
});

test("текущая серия отмечена в списке, 360px без скролла, axe", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/anime/frieren/2");
  await expect(page.locator('a[aria-current="page"]')).toHaveAccessibleName(/^Эпизод 02/);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
  expect(blocking).toEqual([]);
});
