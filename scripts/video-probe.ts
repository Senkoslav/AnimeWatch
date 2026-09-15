/**
 * pnpm video:probe <файл…> [--no-upscale-test]
 *
 * Разбирает мастер-файлы серий через ffprobe и печатает markdown для раздела
 * «Результаты ffprobe» в docs/05-video-pipeline.md: параметры видео, все
 * аудиодорожки и субтитры, оценку апскейла для кадра выше 1080p.
 *
 * Оценка апскейла. Кадр уменьшается вдвое и растягивается обратно (lanczos),
 * потеря считается как 1 − SSIM по яркости. В апскейле с 1080p деталей выше
 * 1080p нет, и такой круг почти ничего не меняет. Чтобы не зависеть от того,
 * насколько детализирован сам кадр, потерю сравниваем с тем же кругом полосой
 * ниже (1080p → 540p → 1080p). Это подсказка: решение принимается по кропам
 * в .tmp/probe/, где слева оригинал, справа кадр после круга.
 */
import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { basename, join, parse, resolve } from "node:path";
import { promisify } from "node:util";

import { asNumber, asObject, asString, isDefined, type Json } from "../lib/unknown";

const execFileAsync = promisify(execFile);

/** Доли длительности, на которых берутся кадры: мимо опенинга и эндинга. */
const SAMPLE_POINTS = [0.2, 0.35, 0.5, 0.65, 0.8];
/** Потеря выше 1080p меньше этой доли от потери ниже 1080p — считаем апскейлом. */
const UPSCALE_RATIO = 0.25;
/** Если и ниже 1080p терять почти нечего, реальная детализация ещё ниже. */
const FLAT_MID_LOSS = 0.004;
/** Размер клетки карты потерь, по которой ищется самый детализированный участок. */
const LOSS_CELL = 8;
/** Усиление разницы на картинке diff, иначе потери апскейла не разглядеть. */
const DIFF_GAIN = 16;
const OUT_DIR = ".tmp/probe";

type Size = { w: number; h: number };

interface VideoTrack {
  codec: string;
  profile: string | undefined;
  bitDepth: number;
  width: number;
  height: number;
  fps: number | undefined;
  interlaced: boolean;
  hdr: string | undefined;
  bitRate: number | undefined;
}

interface AudioTrack {
  codec: string;
  channels: number | undefined;
  language: string | undefined;
  title: string | undefined;
  bitRate: number | undefined;
  isDefault: boolean;
}

interface SubtitleTrack {
  codec: string;
  language: string | undefined;
  title: string | undefined;
  isDefault: boolean;
  isForced: boolean;
}

interface ProbeResult {
  name: string;
  container: string;
  sizeBytes: number;
  durationSec: number;
  bitRate: number | undefined;
  video: VideoTrack;
  audio: AudioTrack[];
  subtitles: SubtitleTrack[];
}

interface UpscaleResult {
  lossHigh: number;
  lossMid: number;
  verdict: string;
  cropPath: string;
  diffPath: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const skipUpscaleTest = args.includes("--no-upscale-test");
  // pnpm запускает скрипт из корня проекта, а пути пользователь даёт от своей папки.
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const files = args.filter((arg) => !arg.startsWith("--")).map((arg) => resolve(cwd, arg));

  if (files.length === 0) {
    console.error("Использование: pnpm video:probe <файл…> [--no-upscale-test]");
    process.exitCode = 1;
    return;
  }

  await ensureTool("ffprobe");
  await ensureTool("ffmpeg");

  const results: { info: ProbeResult; upscale: UpscaleResult | undefined }[] = [];
  let failed = 0;

  for (const file of files) {
    try {
      await stat(file).catch((error: unknown) => {
        throw new Error("файл не найден", { cause: error });
      });
      console.error(`${basename(file)}: ffprobe`);
      const info = await probe(file);

      let upscale: UpscaleResult | undefined;
      if (!skipUpscaleTest && info.video.height > 1080) {
        console.error(`${basename(file)}: тест апскейла по ${SAMPLE_POINTS.length} кадрам`);
        upscale = await upscaleTest(file, info);
      }
      results.push({ info, upscale });
    } catch (error) {
      failed += 1;
      console.error(`Ошибка, ${file}: ${errorMessage(error)}`);
    }
  }

  if (results.length > 0) {
    console.log(renderMarkdown(results));
  }
  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function probe(file: string): Promise<ProbeResult> {
  const stdout = await exec("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const root = asObject(JSON.parse(stdout));
  const format = asObject(root?.format);
  const streams = (Array.isArray(root?.streams) ? root.streams : []).map(asObject).filter(isDefined);

  const videoStream = streams.find(
    (stream) => stream.codec_type === "video" && asObject(stream.disposition)?.attached_pic !== 1,
  );
  if (!format || !videoStream) {
    throw new Error("ffprobe не нашёл видеопоток");
  }

  const width = asNumber(videoStream.width);
  const height = asNumber(videoStream.height);
  const durationSec = asNumber(format.duration) ?? asNumber(videoStream.duration);
  if (!width || !height || !durationSec) {
    throw new Error("ffprobe не вернул размер кадра или длительность");
  }

  const transfer = asString(videoStream.color_transfer);
  const fieldOrder = asString(videoStream.field_order);

  return {
    name: basename(file),
    container: containerName(asString(format.format_name)),
    sizeBytes: asNumber(format.size) ?? (await stat(file)).size,
    durationSec,
    bitRate: asNumber(format.bit_rate),
    video: {
      codec: asString(videoStream.codec_name) ?? "?",
      profile: asString(videoStream.profile),
      bitDepth: bitDepth(videoStream),
      width,
      height,
      fps: parseRate(videoStream.avg_frame_rate) ?? parseRate(videoStream.r_frame_rate),
      interlaced: fieldOrder !== undefined && fieldOrder !== "progressive" && fieldOrder !== "unknown",
      hdr: transfer === "smpte2084" ? "HDR10 (PQ)" : transfer === "arib-std-b67" ? "HLG" : undefined,
      bitRate: streamBitRate(videoStream),
    },
    audio: streams
      .filter((stream) => stream.codec_type === "audio")
      .map((stream) => ({
        codec: asString(stream.codec_name) ?? "?",
        channels: asNumber(stream.channels),
        language: tag(stream, "language"),
        title: tag(stream, "title"),
        bitRate: streamBitRate(stream),
        isDefault: asObject(stream.disposition)?.default === 1,
      })),
    subtitles: streams
      .filter((stream) => stream.codec_type === "subtitle")
      .map((stream) => ({
        codec: asString(stream.codec_name) ?? "?",
        language: tag(stream, "language"),
        title: tag(stream, "title"),
        isDefault: asObject(stream.disposition)?.default === 1,
        isForced: asObject(stream.disposition)?.forced === 1,
      })),
  };
}

async function upscaleTest(file: string, info: ProbeResult): Promise<UpscaleResult> {
  const full: Size = { w: info.video.width, h: info.video.height };
  const half: Size = { w: Math.round(full.w / 2), h: Math.round(full.h / 2) };
  const quarter: Size = { w: Math.round(full.w / 4), h: Math.round(full.h / 4) };

  // gray16le: сравниваем только яркость и без дизеринга при переводе 10 бит в 8.
  const highFilter =
    `[0:v]format=gray16le,split=2[ref][tmp];` +
    `[tmp]${roundTrip(full, half)}[rt];[ref][rt]ssim=stats_file=-`;
  const midFilter =
    `[0:v]format=gray16le,${scale(half)},split=2[ref][tmp];` +
    `[tmp]${roundTrip(half, quarter)}[rt];[ref][rt]ssim=stats_file=-`;

  const highLosses: number[] = [];
  const midLosses: number[] = [];
  for (const point of SAMPLE_POINTS) {
    const at = info.durationSec * point;
    highLosses.push(await frameLoss(file, at, highFilter));
    midLosses.push(await frameLoss(file, at, midFilter));
  }

  // Картинки для глаз — по кадру из середины серии.
  const dir = join(OUT_DIR, parse(file).name);
  await mkdir(dir, { recursive: true });
  const at = (info.durationSec * 0.5).toFixed(2);
  const lossGraph = `[0:v]format=gray16le,split=2[ref][tmp];[tmp]${roundTrip(full, half)}[rt];[ref][rt]blend=all_mode=difference`;

  // Кроп берём там, где потеря максимальна: центр кадра часто однотонный фон.
  const map = await lossMap(file, at, lossGraph, full);
  const cropSize: Size = { w: Math.min(960, full.w), h: Math.min(540, full.h) };
  const origin = busiestRegion(map, cropSize, full);
  const crop = `crop=${cropSize.w}:${cropSize.h}:${origin.x}:${origin.y}`;
  const cropPath = join(dir, "crop-50.png");
  await exec("ffmpeg", [
    "-v", "error", "-nostdin", "-y", "-ss", at, "-i", file, "-frames:v", "1",
    "-filter_complex",
    `[0:v]split=2[ref][tmp];[tmp]${roundTrip(full, half)}[rt];` +
      `[ref]${crop}[a];[rt]${crop}[b];[a][b]hstack=inputs=2`,
    "-update", "1", cropPath,
  ]);

  // Разница «оригинал − круг», усиленная: чёрный кадр значит, что выше 1080p терять нечего.
  const diffPath = join(dir, "diff-50.png");
  await exec("ffmpeg", [
    "-v", "error", "-nostdin", "-y", "-ss", at, "-i", file, "-frames:v", "1",
    "-filter_complex",
    `${lossGraph},lut=c0=clip(val*${DIFF_GAIN}\\,0\\,maxval),scale=1920:-2:flags=area`,
    "-update", "1", diffPath,
  ]);

  const lossHigh = median(highLosses);
  const lossMid = median(midLosses);
  return { lossHigh, lossMid, verdict: upscaleVerdict(lossHigh, lossMid), cropPath, diffPath };
}

interface LossMap {
  values: Float64Array;
  cols: number;
  rows: number;
}

/** Потеря после круга, усреднённая по клеткам LOSS_CELL×LOSS_CELL пикселей. */
async function lossMap(file: string, at: string, lossGraph: string, full: Size): Promise<LossMap> {
  const cols = Math.floor(full.w / LOSS_CELL);
  const rows = Math.floor(full.h / LOSS_CELL);
  const raw = await execBuffer("ffmpeg", [
    "-v", "error", "-nostdin", "-ss", at, "-i", file, "-frames:v", "1",
    "-filter_complex", `${lossGraph},scale=${cols}:${rows}:flags=area`,
    "-f", "rawvideo", "-pix_fmt", "gray16le", "-",
  ]);
  if (raw.length < cols * rows * 2) {
    throw new Error("ffmpeg вернул неполную карту потерь");
  }
  const values = new Float64Array(cols * rows);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = raw.readUInt16LE(i * 2);
  }
  return { values, cols, rows };
}

/** Левый верхний угол окна размером crop с максимальной суммарной потерей. */
function busiestRegion(map: LossMap, crop: Size, full: Size): { x: number; y: number } {
  const { values, cols, rows } = map;
  const windowCols = Math.min(cols, Math.max(1, Math.round(crop.w / LOSS_CELL)));
  const windowRows = Math.min(rows, Math.max(1, Math.round(crop.h / LOSS_CELL)));

  // Таблица префиксных сумм: сумма любого окна за O(1).
  const stride = cols + 1;
  const sums = new Float64Array(stride * (rows + 1));
  const sumAt = (x: number, y: number) => sums[y * stride + x] ?? 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      sums[(y + 1) * stride + x + 1] =
        (values[y * cols + x] ?? 0) + sumAt(x + 1, y) + sumAt(x, y + 1) - sumAt(x, y);
    }
  }

  let best = -1;
  let bestX = 0;
  let bestY = 0;
  for (let y = 0; y + windowRows <= rows; y += 1) {
    for (let x = 0; x + windowCols <= cols; x += 1) {
      const sum =
        sumAt(x + windowCols, y + windowRows) - sumAt(x + windowCols, y) - sumAt(x, y + windowRows) + sumAt(x, y);
      if (sum > best) {
        best = sum;
        bestX = x;
        bestY = y;
      }
    }
  }

  return {
    x: Math.min(bestX * LOSS_CELL, full.w - crop.w),
    y: Math.min(bestY * LOSS_CELL, full.h - crop.h),
  };
}

async function frameLoss(file: string, atSec: number, filter: string): Promise<number> {
  const stdout = await exec("ffmpeg", [
    "-v", "error", "-nostdin",
    "-ss", atSec.toFixed(2),
    "-i", file,
    "-frames:v", "1",
    "-filter_complex", filter,
    "-f", "null", "-",
  ]);
  const ssim = Number(/Y:([\d.]+)/.exec(stdout)?.[1]);
  if (!Number.isFinite(ssim)) {
    throw new Error(`ffmpeg не вернул SSIM на ${atSec.toFixed(0)} с`);
  }
  return 1 - ssim;
}

function upscaleVerdict(lossHigh: number, lossMid: number): string {
  if (lossMid < FLAT_MID_LOSS) {
    return "детализации нет даже на 1080p, вероятно апскейл с 720p или ниже";
  }
  if (lossHigh / lossMid < UPSCALE_RATIO) {
    return "похоже на апскейл с 1080p, деталей выше 1080p почти нет";
  }
  return "есть детализация выше 1080p, сверить кропы";
}

function renderMarkdown(results: { info: ProbeResult; upscale: UpscaleResult | undefined }[]): string {
  const lines = [
    `### Результаты ffprobe, ${new Date().toISOString().slice(0, 10)}`,
    "",
    "| Файл | Контейнер | Видео | Кадр | FPS | Длительность | Битрейт общий | Битрейт видео | Размер |",
    "|---|---|---|---|---|---|---|---|---|",
  ];

  for (const { info } of results) {
    const { video } = info;
    const videoLabel = [
      [video.codec.toUpperCase(), video.profile].filter(Boolean).join(" "),
      `${video.bitDepth} бит`,
      video.hdr,
      video.interlaced ? "чересстрочное" : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(
      "| " +
        [
          cell(info.name),
          info.container,
          videoLabel,
          `${video.width}×${video.height}`,
          formatFps(video.fps),
          formatDuration(info.durationSec),
          formatMbit(info.bitRate),
          formatMbit(video.bitRate),
          `${(info.sizeBytes / 1024 ** 3).toFixed(2)} ГБ`,
        ].join(" | ") +
        " |",
    );
  }

  for (const { info, upscale } of results) {
    lines.push("", `#### ${info.name}`, "");

    const audio = info.audio.map((track, i) =>
      [
        `${i + 1}) ${track.codec.toUpperCase()}`,
        track.channels ? `${track.channels} кан.` : undefined,
        track.language,
        track.title ? `«${track.title}»` : undefined,
        formatKbit(track.bitRate),
        track.isDefault ? "по умолчанию" : undefined,
      ]
        .filter(Boolean)
        .join(", "),
    );
    lines.push(`- Аудио: ${audio.length > 0 ? audio.join("; ") : "нет"}`);
    if (info.audio.length > 1) {
      lines.push("- Внимание: аудиодорожек несколько, проверить, какую возьмёт Bunny (задача 4).");
    }

    const subtitles = info.subtitles.map((track) =>
      [
        track.codec,
        track.language,
        track.title ? `«${track.title}»` : undefined,
        track.isForced ? "forced" : undefined,
        track.isDefault ? "по умолчанию" : undefined,
      ]
        .filter(Boolean)
        .join(", "),
    );
    lines.push(`- Субтитры: ${subtitles.length > 0 ? subtitles.join("; ") : "нет"}`);

    if (upscale) {
      const ratio = upscale.lossMid > 0 ? (upscale.lossHigh / upscale.lossMid).toFixed(2) : "—";
      lines.push(
        `- Апскейл: ${upscale.verdict}. Потеря выше 1080p ${upscale.lossHigh.toFixed(4)}, ` +
          `ниже 1080p ${upscale.lossMid.toFixed(4)}, отношение ${ratio}.`,
        `- Кроп (слева оригинал, справа после круга): \`${upscale.cropPath}\`; ` +
          `карта потерь: \`${upscale.diffPath}\``,
      );
    } else if (info.video.height <= 1080) {
      lines.push("- Апскейл: кадр не выше 1080p, дорожка 2160p не нужна.");
    }
  }

  return lines.join("\n");
}

function roundTrip(from: Size, via: Size): string {
  return `${scale(via)},${scale(from)}`;
}

function scale(size: Size): string {
  return `scale=${size.w}:${size.h}:flags=lanczos`;
}

async function ensureTool(name: string): Promise<void> {
  try {
    await execFileAsync(name, ["-version"]);
  } catch (error) {
    throw new Error(`${name} не найден. Установи ffmpeg: brew install ffmpeg`, { cause: error });
  }
}

async function exec(command: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, { maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    throw commandError(command, error);
  }
}

async function execBuffer(command: string, args: string[]): Promise<Buffer> {
  try {
    const { stdout } = await execFileAsync(command, args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    throw commandError(command, error);
  }
}

/** Ошибка с последними строками stderr: без них «ffmpeg упал» ничего не объясняет. */
function commandError(command: string, error: unknown): Error {
  const stderr =
    typeof error === "object" && error !== null && "stderr" in error
      ? String(error.stderr).trim().split("\n").slice(-3).join(" / ")
      : "";
  return new Error(`${command} завершился с ошибкой${stderr ? `: ${stderr}` : ""}`, { cause: error });
}

function containerName(formatName: string | undefined): string {
  if (!formatName) return "?";
  if (formatName.includes("matroska")) return "MKV";
  if (formatName.includes("mp4") || formatName.includes("mov")) return "MP4";
  if (formatName.includes("mpegts")) return "MPEG-TS";
  return formatName;
}

function bitDepth(stream: Json): number {
  const raw = asNumber(stream.bits_per_raw_sample);
  if (raw) return raw;
  const match = /p(\d{2})(?:le|be)$/.exec(asString(stream.pix_fmt) ?? "");
  return match?.[1] ? Number(match[1]) : 8;
}

/** В MKV битрейт дорожки часто лежит не в bit_rate, а в тегах статистики mkvmerge. */
function streamBitRate(stream: Json): number | undefined {
  return asNumber(stream.bit_rate) ?? asNumber(tag(stream, "BPS"));
}

/** Теги в MKV бывают с суффиксом языка: BPS-eng. Регистр тоже плавает. */
function tag(stream: Json, name: string): string | undefined {
  const tags = asObject(stream.tags);
  if (!tags) return undefined;
  const wanted = name.toLowerCase();
  const key = Object.keys(tags).find((candidate) => {
    const lower = candidate.toLowerCase();
    return lower === wanted || lower.startsWith(`${wanted}-`);
  });
  return key ? asString(tags[key]) : undefined;
}

function parseRate(value: unknown): number | undefined {
  const [numerator, denominator] = (asString(value) ?? "").split("/").map(Number);
  if (numerator === undefined || !Number.isFinite(numerator) || numerator <= 0) return undefined;
  if (denominator === undefined) return numerator;
  return denominator > 0 ? numerator / denominator : undefined;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? upper) + upper) / 2;
}

function formatDuration(totalSec: number): string {
  const sec = Math.round(totalSec);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(sec % 60)}` : `${minutes}:${pad(sec % 60)}`;
}

function formatFps(fps: number | undefined): string {
  if (fps === undefined) return "—";
  return Number.isInteger(fps) ? String(fps) : fps.toFixed(3);
}

function formatMbit(bitsPerSecond: number | undefined): string {
  return bitsPerSecond === undefined ? "—" : `${(bitsPerSecond / 1e6).toFixed(1)} Мбит/с`;
}

function formatKbit(bitsPerSecond: number | undefined): string | undefined {
  return bitsPerSecond === undefined ? undefined : `${Math.round(bitsPerSecond / 1000)} кбит/с`;
}

function cell(text: string): string {
  return text.replaceAll("|", "\\|");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
