/**
 * Иконки и картинка превью из одного исходника — public/brand/mark.svg. Запуск после правки знака:
 *   node scripts/brand/render.mjs
 * Рисует через Chromium из Playwright (уже есть в devDependencies): те же шрифты и SVG, что в браузере.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

// Цвета — из токенов app/globals.css (docs/04): файлы иконок CSS сайта не видят, но и своих hex у
// них нет — поменяли токен, пересобрали иконки, и они совпали с сайтом.
const css = readFileSync("app/globals.css", "utf8");
function token(name) {
  const value = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
  if (!value) throw new Error(`в app/globals.css нет токена --color-${name}`);
  return value;
}
const BG = token("bg");
const SURFACE = token("surface");
const TEXT = token("text");
const DIM = token("muted");

const mark = readFileSync("public/brand/mark.svg", "utf8").replace(/<!--[\s\S]*?-->\s*/, "");

/** Плитка: знак на графите со скруглением. inset — доля поля вокруг знака (у maskable больше). */
function tile(size, { inset = 0.18, radius = 0.22 } = {}) {
  const pad = Math.round(size * inset);
  return `<div style="width:${size}px;height:${size}px;background:${SURFACE};border-radius:${Math.round(size * radius)}px;display:grid;place-items:center">
    <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${mark}</div></div>`;
}

/** Иконка вкладки браузера — SVG-плитка: чёткая в любом размере, одинаковая на светлой и тёмной вкладке. */
const inner = mark.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
writeFileSync(
  "app/icon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${SURFACE}"/>
  <g transform="translate(16 16) scale(0.68)">${inner.trim()}</g>
</svg>
`,
);

const og = `<div style="width:1200px;height:630px;background:${BG};display:flex;flex-direction:column;justify-content:center;gap:40px;padding:0 96px;box-sizing:border-box;font-family:Unbounded,sans-serif">
  <div style="display:flex;align-items:center;gap:36px">
    <div style="width:180px;height:180px">${mark}</div>
    <div style="font-weight:700;font-size:112px;letter-spacing:-0.04em;color:${TEXT}">AnimeWatch</div>
  </div>
  <div style="font-family:'Golos Text',sans-serif;font-size:40px;color:${DIM};max-width:900px;line-height:1.35">Каталог аниме: поиск, расписание онгоингов и серии в плеере поставщика</div>
</div>`;

const shots = [
  { file: "app/apple-icon.png", size: 180, html: tile(180, { inset: 0.16, radius: 0 }) },
  { file: "public/brand/icon-192.png", size: 192, html: tile(192) },
  { file: "public/brand/icon-512.png", size: 512, html: tile(512) },
  // maskable: система сама скругляет и режет края, знак обязан влезть в центральные 80 %.
  { file: "public/brand/icon-512-maskable.png", size: 512, html: tile(512, { inset: 0.26, radius: 0 }) },
  { file: "app/opengraph-image.png", width: 1200, height: 630, html: og },
];

const browser = await chromium.launch();
try {
  for (const shot of shots) {
    const width = shot.width ?? shot.size;
    const height = shot.height ?? shot.size;
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(
      `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400&family=Unbounded:wght@700&display=block">
       <body style="margin:0;background:transparent">${shot.html}</body>`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot.file, omitBackground: true, clip: { x: 0, y: 0, width, height } });
    await page.close();
    console.log(`  ${shot.file}`);
  }
} finally {
  await browser.close();
}
