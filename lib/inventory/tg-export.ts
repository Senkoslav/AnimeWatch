/**
 * Разбор выгрузки истории канала из Telegram Desktop (JSON) и угадывание тайтла и
 * номера серии по подписи поста и имени файла. Результат — черновик для человека:
 * на нестандартных подписях эвристики ошибаются, такие строки получают пометку.
 */
import { asNumber, asObject, asString, isDefined, type Json } from "../unknown";

export interface TgChatSummary {
  id: string;
  name: string;
  messages: number;
  videos: number;
}

export interface TgVideoPost {
  /** Id канала без префикса -100, как в ссылках t.me/c/<id>/<message>. */
  chatId: string;
  messageId: number;
  postedAt: string;
  caption: string;
  fileName: string | undefined;
  sizeBytes: number | undefined;
}

export interface TgExport {
  chats: TgChatSummary[];
  posts: TgVideoPost[];
}

const VIDEO_EXTENSION = /\.(?:mkv|mp4|m4v|mov|avi|ts|m2ts|webm)$/i;
/** Гифки, кружки и голосовые тоже бывают video/mp4, но это не серии. */
const NOT_EPISODE_MEDIA = new Set(["animation", "video_message", "voice_message", "audio_file", "sticker"]);

export function parseTelegramExport(data: unknown): TgExport {
  const root = asObject(data);
  if (!root) {
    throw new Error("выгрузка Telegram должна быть JSON-объектом");
  }

  const chats: TgChatSummary[] = [];
  const posts: TgVideoPost[] = [];
  for (const chat of chatsOf(root)) {
    const chatId = asNumber(chat.id);
    if (chatId === undefined) {
      throw new Error(`в выгрузке чат «${asString(chat.name) ?? "?"}» без id`);
    }
    const messages = (Array.isArray(chat.messages) ? chat.messages : []).map(asObject).filter(isDefined);
    const videos = messages.filter(isEpisodeFile);
    chats.push({
      id: String(chatId),
      name: asString(chat.name) ?? "без названия",
      messages: messages.length,
      videos: videos.length,
    });

    for (const message of videos) {
      const messageId = asNumber(message.id);
      if (messageId === undefined) {
        throw new Error(`в чате ${chatId} сообщение с видео без id`);
      }
      posts.push({
        chatId: String(chatId),
        messageId,
        postedAt: asString(message.date) ?? "",
        caption: textOf(message.text).trim(),
        fileName: asString(message.file_name),
        sizeBytes: asNumber(message.file_size),
      });
    }
  }
  return { chats, posts };
}

/** Экспорт одного чата лежит в корне, экспорт всего аккаунта — в chats.list. */
function chatsOf(root: Json): Json[] {
  if (Array.isArray(root.messages)) {
    return [root];
  }
  const list = asObject(root.chats)?.list;
  if (Array.isArray(list)) {
    return list.map(asObject).filter(isDefined);
  }
  throw new Error("не похоже на выгрузку Telegram Desktop: нет ни messages, ни chats.list");
}

function isEpisodeFile(message: Json): boolean {
  if (message.type !== "message") return false;
  const mediaType = asString(message.media_type);
  if (mediaType !== undefined && NOT_EPISODE_MEDIA.has(mediaType)) return false;
  if (message.file === undefined && message.file_name === undefined) return false;
  return (
    mediaType === "video_file" ||
    (asString(message.mime_type)?.startsWith("video/") ?? false) ||
    VIDEO_EXTENSION.test(asString(message.file_name) ?? "")
  );
}

/** text бывает строкой или массивом из строк и объектов-сущностей { type, text }. */
function textOf(text: unknown): string {
  if (typeof text === "string") return text;
  if (!Array.isArray(text)) return "";
  return text
    .map((part: unknown) => (typeof part === "string" ? part : (asString(asObject(part)?.text) ?? "")))
    .join("");
}

export interface EpisodeGuess {
  title: string;
  episode: number | undefined;
  /** Что проверить человеку; пусто, если догадка уверенная. */
  notes: string[];
}

interface EpisodePattern {
  pattern: RegExp;
  /** Пометка для человека, если паттерн часто ошибается. */
  weak?: string;
}

// От явных пометок к слабым догадкам. Флаг u и \p{…} вместо \b: в JS \b видит только латиницу.
const EPISODE_PATTERNS: readonly EpisodePattern[] = [
  { pattern: /(?<![\p{L}\p{N}])S\d{1,2}\s*E(\d{1,4})(?!\p{N})/iu }, // S01E07
  { pattern: /(?<![\p{L}\p{N}])(?:episode|ep|e)\s*\.?\s*(\d{1,4})(?!\p{N})/iu }, // E07, Ep. 7
  { pattern: /(?<!\p{N})(\d{1,4})\s*(?:-?\s*(?:я|ая|ый))?\s*(?:серия|эпизод)(?!\p{L})/iu }, // 7 серия
  { pattern: /(?<!\p{L})(?:серия|эпизод)\s*(?:№\s*)?(\d{1,4})(?!\p{N})/iu }, // серия 7, эпизод №7
  { pattern: /\s[-–—]\s*(\d{1,4})(?:v\d)?(?![\p{L}\p{N}])(?!\s*(?:сезон|season|часть|part))/iu }, // Title - 07
  { pattern: /\[(\d{1,3})(?:v\d)?\]/u }, // [07]
  {
    // «Кайдзю №8» — это название, а не восьмая серия.
    pattern: /(?<![\p{L}\p{N}])[#№]\s?(\d{1,4})(?!\p{N})/u,
    weak: "номер серии угадан по знаку # или №",
  },
];
const FILE_TRAILING_NUMBER: EpisodePattern = {
  pattern: /[\s_.-](\d{1,3})(?:v\d)?\.[\p{L}\p{N}]{2,4}$/u, // Title_07.mkv
  weak: "номер серии угадан по числу в конце имени файла",
};
const CAPTION_TRAILING_NUMBER: EpisodePattern = {
  pattern: /\s(\d{1,3})\s*$/u, // «Фрирен 7»
  weak: "номер серии угадан по числу в конце подписи",
};
const FILE_EXTENSION = /\.[\p{L}\p{N}]{2,4}$/u;
/** Пометки релиза в имени файла, которые не относятся к названию. */
const RELEASE_TOKENS =
  /(?<![\p{L}\p{N}])(?:\d{3,4}p|4k|uhd|hdr|x26[45]|h\.?26[45]|hevc|avc|10bit|8bit|web-?dl|web-?rip|bd-?rip|blu-?ray|aac|flac|ac3|opus|rus|jap|jpn|eng|bebradub)(?![\p{L}\p{N}])/giu;

export function guessEpisode(caption: string, fileName: string | undefined): EpisodeGuess {
  const notes: string[] = [];
  const firstLine =
    caption
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line !== "") ?? "";

  let source: "caption" | "file" | undefined;
  let found = findEpisode(caption, EPISODE_PATTERNS);
  if (found) {
    source = "caption";
  } else if (fileName) {
    found = findEpisode(fileName, [...EPISODE_PATTERNS, FILE_TRAILING_NUMBER]);
    if (found) source = "file";
  }
  if (!found) {
    found = findEpisode(firstLine, [CAPTION_TRAILING_NUMBER]);
    if (found) source = "caption";
  }

  if (!found) {
    notes.push("номер серии не найден");
  } else if (found.weak) {
    notes.push(found.weak);
  }

  const captionTitle = cleanTitle(source === "caption" && found ? firstLine.replace(found.match, " ") : firstLine);
  const title =
    captionTitle !== ""
      ? captionTitle
      : fileName
        ? titleFromFileName(fileName, source === "file" ? found?.match : undefined)
        : "";
  if (title === "") {
    notes.push("название не найдено");
  }

  return { title, episode: found?.episode, notes };
}

function findEpisode(
  text: string,
  patterns: readonly EpisodePattern[],
): { episode: number; match: string; weak: string | undefined } | undefined {
  for (const { pattern, weak } of patterns) {
    const found = pattern.exec(text);
    const episode = Number(found?.[1]);
    if (found && Number.isInteger(episode) && episode > 0) {
      return { episode, match: found[0], weak };
    }
  }
  return undefined;
}

function titleFromFileName(fileName: string, episodeMatch: string | undefined): string {
  let base = fileName.replace(FILE_EXTENSION, "");
  if (episodeMatch) {
    base = base.replace(episodeMatch.replace(FILE_EXTENSION, ""), " ");
  }
  return cleanTitle(base.replace(/[_.]+/gu, " ").replace(RELEASE_TOKENS, " "));
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/gu, " ")
    .replace(/[\p{Extended_Pictographic}️]/gu, " ")
    .replace(/[«»"“”#]/gu, " ")
    .replace(/\s+/gu, " ")
    .replace(/^[\s\-–—|:,.;]+|[\s\-–—|:,.;]+$/gu, "");
}
