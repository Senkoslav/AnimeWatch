/**
 * Чтение видео из Bunny Stream API. Ключ библиотеки — серверный секрет.
 */
import { asNumber, asObject, asString } from "../unknown";

const API_TIMEOUT_MS = 15_000;

export const VIDEO_STATUS_FINISHED = 4;

const VIDEO_STATUS_LABELS: Record<number, string> = {
  0: "создано",
  1: "загружено",
  2: "обрабатывается",
  3: "кодируется",
  4: "готово",
  5: "ошибка кодирования",
  6: "загрузка не удалась",
};

export function videoStatusLabel(status: number): string {
  return VIDEO_STATUS_LABELS[status] ?? `неизвестный статус ${status}`;
}

export interface StreamVideo {
  guid: string;
  title: string;
  status: number;
  encodeProgress: number;
  lengthSec: number;
  width: number;
  height: number;
  resolutions: string[];
  storageBytes: number;
  transcodingMessages: string[];
}

export interface StreamVideoRequest {
  libraryId: string;
  apiKey: string;
  videoId: string;
}

export async function getStreamVideo({ libraryId, apiKey, videoId }: StreamVideoRequest): Promise<StreamVideo> {
  const url = `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoId)}`;
  const response = await fetch(url, {
    headers: { AccessKey: apiKey, accept: "application/json" },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Bunny Stream API ответил ${response.status} на запрос видео ${videoId}`);
  }

  const body = asObject(await response.json());
  if (!body) {
    throw new Error(`Bunny Stream API вернул не объект для видео ${videoId}`);
  }

  return {
    guid: asString(body.guid) ?? videoId,
    title: asString(body.title) ?? "",
    status: asNumber(body.status) ?? -1,
    encodeProgress: asNumber(body.encodeProgress) ?? 0,
    lengthSec: asNumber(body.length) ?? 0,
    width: asNumber(body.width) ?? 0,
    height: asNumber(body.height) ?? 0,
    resolutions: (asString(body.availableResolutions) ?? "")
      .split(",")
      .map((resolution) => resolution.trim())
      .filter((resolution) => resolution !== ""),
    storageBytes: asNumber(body.storageSize) ?? 0,
    transcodingMessages: (Array.isArray(body.transcodingMessages) ? body.transcodingMessages : []).map(
      (message: unknown) => asString(asObject(message)?.message) ?? JSON.stringify(message),
    ),
  };
}
