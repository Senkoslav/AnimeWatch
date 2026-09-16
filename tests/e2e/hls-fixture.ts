/**
 * Подмена Bunny CDN в e2e: плеер получает настоящий подписанный URL (подпись считает сервер), а сегменты
 * отдаются из tests/fixtures/hls — 8 секунд, 240p и 360p, H.264 + AAC, как у Bunny.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Page, Route } from "@playwright/test";

export const E2E_CDN_HOSTNAME = "vz-e2e.b-cdn.net";

const FIXTURE_DIR = path.resolve("tests/fixtures/hls");
const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

export interface CdnStub {
  /** Токены (значение bcdn_token из пути) в порядке первого появления. */
  tokens: string[];
  /** Правило «CDN отвечает 403», как на протухший токен. По умолчанию отказов нет. */
  reject: (token: string, file: string) => boolean;
  /** Задержка перед первым 403, мс (дальше отказы мгновенные). */
  firstRejectDelayMs: number;
}

/** Путь Bunny: /bcdn_token=HS256-…&token_path=…&expires=…/<videoId>/<файл внутри видео>. */
function parse(url: URL): { token: string; file: string } | null {
  const [tokenSegment, , ...rest] = url.pathname.split("/").filter(Boolean);
  const token = tokenSegment?.match(/^bcdn_token=([^&]+)/)?.[1];
  return token && rest.length > 0 ? { token, file: rest.join("/") } : null;
}

export async function stubCdn(page: Page): Promise<CdnStub> {
  const stub: CdnStub = { tokens: [], reject: () => false, firstRejectDelayMs: 0 };

  await page.route(`https://${E2E_CDN_HOSTNAME}/**`, async (route: Route) => {
    const parsed = parse(new URL(route.request().url()));
    const headers = { "Access-Control-Allow-Origin": "*" };
    if (!parsed) return route.fulfill({ status: 403, headers });

    if (!stub.tokens.includes(parsed.token)) stub.tokens.push(parsed.token);
    if (stub.reject(parsed.token, parsed.file)) {
      const delay = stub.firstRejectDelayMs;
      stub.firstRejectDelayMs = 0;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return route.fulfill({ status: 403, headers });
    }

    const file = path.resolve(FIXTURE_DIR, parsed.file);
    if (!file.startsWith(FIXTURE_DIR)) return route.fulfill({ status: 404, headers });
    try {
      const body = await readFile(file);
      return route.fulfill({
        status: 200,
        body,
        headers: { ...headers, "Content-Type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream" },
      });
    } catch {
      return route.fulfill({ status: 404, headers });
    }
  });

  return stub;
}
