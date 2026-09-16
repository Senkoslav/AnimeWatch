/**
 * pnpm bunny:check <videoId> [--referer <url>]
 *
 * Приёмка задачи «Библиотека в Bunny, ключи, hotlink protection и токены»:
 * тестовое видео играет по подписанному URL и не играет без него.
 *
 * Проверяется вся цепочка HLS, а не один плейлист. С токеном должны отдаваться
 * мастер-плейлист, вариант и сегмент, и ffmpeg должен декодировать поток так же,
 * как плеер: по относительным путям. Без токена, с протухшим токеном, с токеном
 * другого видео и с чужим Referer — 403. Перед сетью подпись сверяется с
 * эталонными векторами Bunny.
 *
 * Env из .env.local: BUNNY_LIBRARY_ID, BUNNY_STREAM_API_KEY, BUNNY_CDN_HOSTNAME,
 * BUNNY_TOKEN_KEY; NEXT_PUBLIC_SITE_URL задаёт Referer по умолчанию.
 */
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { signCdnUrl, signedPlaylistUrl } from "../lib/bunny/sign";
import { getStreamVideo, VIDEO_STATUS_FINISHED, videoStatusLabel } from "../lib/bunny/stream";
import { asNumber, asObject, asString, isDefined } from "../lib/unknown";

const execFileAsync = promisify(execFile);

const TOKEN_TTL_SEC = 3600;
const REQUEST_TIMEOUT_MS = 15_000;
const DECODE_SECONDS = 5;
const VECTORS_PATH = "tests/fixtures/bunny-token-vectors.json";
const FOREIGN_REFERER = "https://hotlinker.example/";

interface CheckResult {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

interface Variant {
  uri: string;
  bandwidth: number | undefined;
  resolution: string | undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const videoId = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--referer");
  if (!videoId) {
    console.error("Использование: pnpm bunny:check <videoId> [--referer <url>]");
    process.exitCode = 1;
    return;
  }

  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  const libraryId = requireEnv("BUNNY_LIBRARY_ID");
  const apiKey = requireEnv("BUNNY_STREAM_API_KEY");
  const hostname = requireEnv("BUNNY_CDN_HOSTNAME");
  const securityKey = requireEnv("BUNNY_TOKEN_KEY");
  const refererIndex = args.indexOf("--referer");
  const referer =
    (refererIndex >= 0 ? args[refererIndex + 1] : undefined) ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/`;

  const vectorsPassed = await verifySignerAgainstVectors();
  console.log(`Подпись совпадает с эталонными векторами Bunny (${vectorsPassed}).`);

  const video = await getStreamVideo({ libraryId, apiKey, videoId });
  console.log(
    `Видео ${video.guid} «${video.title}»: ${videoStatusLabel(video.status)}, ` +
      `${formatDuration(video.lengthSec)}, исходник ${video.width}×${video.height}, ` +
      `качества ${video.resolutions.join(", ") || "—"}, хранение ${(video.storageBytes / 1024 ** 2).toFixed(1)} МБ`,
  );
  for (const message of video.transcodingMessages) {
    console.log(`  сообщение кодировщика: ${message}`);
  }
  if (video.status !== VIDEO_STATUS_FINISHED) {
    console.error(`Видео ещё не готово (${video.encodeProgress}%), проверь позже.`);
    process.exitCode = 1;
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const masterUrl = signedPlaylistUrl({ hostname, securityKey, videoId, expiresAt: now + TOKEN_TTL_SEC });
  console.log(`Referer: ${referer}\n`);

  const results: CheckResult[] = [];
  const expectStatus = (name: string, expected: number, actual: number) =>
    results.push({ name, expected: String(expected), actual: String(actual), passed: actual === expected });

  const master = await request(masterUrl, referer, "text");
  expectStatus("мастер-плейлист с токеном", 200, master.status);
  if (master.status !== 200) {
    printResults(results);
    // Токен и список разрешённых доменов оба отвечают 403 — разводим причины.
    const withoutReferer = await request(masterUrl, undefined, "none");
    if (withoutReferer.status === 200) {
      console.log(
        `\nБез Referer подписанный URL открывается, значит ${new URL(referer).host} нет в разрешённых ` +
          "доменах библиотеки. Порт в списке учитывается: localhost и localhost:3000 — разные записи.",
      );
    }
    console.log("Отказные проверки пропущены: пока подписанный URL не открывается, их 403 ничего не доказывает.");
    process.exitCode = 1;
    return;
  }
  const variants = parseMasterPlaylist(master.body);

  const best = variants.reduce<Variant | undefined>(
    (top, variant) => ((variant.bandwidth ?? 0) > (top?.bandwidth ?? -1) ? variant : top),
    undefined,
  );
  let segmentUrl: URL | undefined;
  if (best) {
    const variantUrl = new URL(best.uri, masterUrl);
    const variant = await request(variantUrl.href, referer, "text");
    expectStatus(`вариант ${best.resolution ?? best.uri} с токеном`, 200, variant.status);
    const segmentUri = variant.status === 200 ? firstMediaUri(variant.body) : undefined;
    if (segmentUri) {
      segmentUrl = new URL(segmentUri, variantUrl);
      expectStatus("сегмент с токеном", 200, (await request(segmentUrl.href, referer, "none")).status);
    }
  }
  if (!segmentUrl) {
    results.push({ name: "сегмент в плейлисте", expected: "есть", actual: "не найден", passed: false });
  }

  const decode = await decodeWithFfmpeg(masterUrl, referer);
  results.push({
    name: `ffmpeg декодирует ${DECODE_SECONDS} с по подписанному URL`,
    expected: "да",
    actual: decode,
    passed: decode === "да",
  });

  expectStatus(
    "мастер-плейлист без токена",
    403,
    (await request(`https://${hostname}/${videoId}/playlist.m3u8`, referer, "none")).status,
  );
  if (segmentUrl) {
    const unsignedPath = segmentUrl.pathname.replace(/^\/bcdn_token=[^/]*/, "");
    expectStatus(
      "сегмент без токена",
      403,
      (await request(`https://${hostname}${unsignedPath}`, referer, "none")).status,
    );
  }

  const expiredUrl = signedPlaylistUrl({ hostname, securityKey, videoId, expiresAt: now - 60 });
  expectStatus("протухший токен", 403, (await request(expiredUrl, referer, "none")).status);

  const otherVideoUrl = signCdnUrl({
    hostname,
    securityKey,
    expiresAt: now + TOKEN_TTL_SEC,
    path: `/${videoId}/playlist.m3u8`,
    tokenPath: `/${randomUUID()}/`,
    tokenInPath: true,
  });
  expectStatus("токен, выданный на другое видео", 403, (await request(otherVideoUrl, referer, "none")).status);
  expectStatus(
    `токен с чужим Referer (${FOREIGN_REFERER})`,
    403,
    (await request(masterUrl, FOREIGN_REFERER, "none")).status,
  );

  printResults(results);

  if (variants.length > 0) {
    const ladder = variants
      .map((variant) => `${variant.resolution ?? variant.uri} ${formatMbit(variant.bandwidth)}`)
      .join(", ");
    console.log(`\nЛестница из мастер-плейлиста (BANDWIDTH): ${ladder}`);
  }

  const failed = results.filter((result) => !result.passed).length;
  console.log(
    failed === 0
      ? `Итог: ${results.length} из ${results.length}, видео играет только по подписанному URL.`
      : `Итог: провалено ${failed} из ${results.length}.`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function verifySignerAgainstVectors(): Promise<string> {
  const fixture = asObject(JSON.parse(await readFile(VECTORS_PATH, "utf8")));
  const securityKey = asString(fixture?.securityKey);
  const expiresAt = asNumber(fixture?.expiresAt);
  const hostname = asString(fixture?.hostname);
  const vectors = (Array.isArray(fixture?.vectors) ? fixture.vectors : []).map(asObject).filter(isDefined);
  if (!securityKey || !expiresAt || !hostname || vectors.length === 0) {
    throw new Error(`${VECTORS_PATH}: нет ключа, времени, хоста или векторов`);
  }

  for (const vector of vectors) {
    const path = asString(vector.path);
    const expected = asString(vector.expected);
    if (!path || !expected) {
      throw new Error(`${VECTORS_PATH}: вектор без path или expected`);
    }
    const actual = signCdnUrl({
      hostname,
      securityKey,
      expiresAt,
      path,
      tokenPath: asString(vector.tokenPath),
      tokenInPath: vector.tokenInPath === true,
    });
    if (actual !== expected) {
      throw new Error(
        `Подпись разошлась с эталоном Bunny («${asString(vector.name) ?? path}»):\n  ${actual}\n  ${expected}`,
      );
    }
  }
  return `${vectors.length} из ${vectors.length}`;
}

function printResults(results: readonly CheckResult[]): void {
  for (const result of results) {
    const verdict = result.passed ? "ОК    " : "ПРОВАЛ";
    const detail = result.passed ? result.actual : `ожидали ${result.expected}, получили ${result.actual}`;
    console.log(`${verdict} ${result.name}: ${detail}`);
  }
}

async function request(
  url: string,
  referer: string | undefined,
  read: "text" | "none",
): Promise<{ status: number; body: string }> {
  try {
    const response = await fetch(url, {
      headers: referer ? { Referer: referer } : {},
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (read === "text") {
      return { status: response.status, body: await response.text() };
    }
    await response.body?.cancel();
    return { status: response.status, body: "" };
  } catch (error) {
    throw new Error(
      `Запрос к CDN не выполнился: ${new URL(url).pathname.replace(/bcdn_token=[^/]*/, "bcdn_token=…")}`,
      {
        cause: error,
      },
    );
  }
}

/** Проигрывание без браузера: ffmpeg идёт по плейлистам и сегментам тем же путём, что и плеер. */
async function decodeWithFfmpeg(url: string, referer: string): Promise<string> {
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-headers",
        `Referer: ${referer}\r\n`,
        "-i",
        url,
        "-t",
        String(DECODE_SECONDS),
        "-f",
        "null",
        "-",
      ],
      { timeout: 60_000 },
    );
    return "да";
  } catch (error) {
    const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr).trim() : "";
    if (stderr === "" && typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return "ffmpeg не установлен";
    }
    return `нет: ${stderr
      .split("\n")
      .slice(-2)
      .join(" / ")
      .replace(/bcdn_token=[^/\s]*/g, "bcdn_token=…")}`;
  }
}

function parseMasterPlaylist(text: string): Variant[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const variants: Variant[] = [];
  lines.forEach((line, index) => {
    if (!line.startsWith("#EXT-X-STREAM-INF:")) return;
    const uri = lines.slice(index + 1).find((next) => next !== "" && !next.startsWith("#"));
    if (!uri) return;
    const attributes = parseAttributes(line.slice("#EXT-X-STREAM-INF:".length));
    variants.push({ uri, bandwidth: asNumber(attributes.BANDWIDTH), resolution: attributes.RESOLUTION });
  });
  return variants;
}

function firstMediaUri(playlist: string): string | undefined {
  return playlist
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== "" && !line.startsWith("#"));
}

function parseAttributes(list: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of list.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
    const [, key, value] = match;
    if (key && value !== undefined) {
      attributes[key] = value.replace(/^"|"$/g, "");
    }
  }
  return attributes;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задан ${name}. Заполни .env.local по образцу .env.example.`);
  }
  return value;
}

function formatDuration(totalSec: number): string {
  const sec = Math.round(totalSec);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function formatMbit(bitsPerSecond: number | undefined): string {
  return bitsPerSecond === undefined ? "—" : `${(bitsPerSecond / 1e6).toFixed(1)} Мбит/с`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
