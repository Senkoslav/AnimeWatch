import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Общий прогон axe по всем публичным страницам. Обе ширины даёт конфиг: chromium-desktop и
 * mobile-chrome, так что каждый адрес здесь проверяется дважды.
 *
 * Отдельным файлом, а не по одной проверке в каждом spec: критерий приёмки у мира «Ночное стекло»
 * сформулирован как «axe чист на восьми страницах», и такой список должен быть виден целиком —
 * иначе забытая страница выглядит как её отсутствие.
 *
 * Более узкие проверки (раскрытый отбор, отправленная форма, пустые состояния) остаются в своих
 * spec: там есть состояние, до которого отсюда не добраться.
 */
const PAGES: [name: string, url: string][] = [
  ["главная", "/"],
  ["каталог", "/catalog"],
  ["страница тайтла", "/anime/frieren"],
  ["просмотр", "/anime/frieren/1"],
  ["поиск", "/search?q=%D1%84%D1%80%D0%B8%D1%80%D0%B5%D0%BD"],
  ["обращение правообладателя", "/dmca"],
  ["соглашение", "/terms"],
  ["конфиденциальность", "/privacy"],
  ["несуществующий адрес", "/anime/there-is-no-such-title"],
];

for (const [name, url] of PAGES) {
  test(`axe: ${name} без нарушений critical и serious`, async ({ page }) => {
    await page.goto(url);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
    expect(blocking, url).toEqual([]);
  });
}

test("на 360px ни одна страница не едет вбок", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  for (const [name, url] of PAGES) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, name).toBeLessThanOrEqual(0);
  }
});
