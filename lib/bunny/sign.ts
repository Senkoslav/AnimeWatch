/**
 * Подпись URL для Bunny CDN Token Authentication (формат HS256, HMAC-SHA256).
 * Эталон — BunnyWay/BunnyCDN.TokenAuthentication, nodejs/token.js; сверяется с его
 * тест-векторами из tests/fixtures/bunny-token-vectors.json.
 *
 * Для HLS токен кладётся в путь (/bcdn_token=…/<videoId>/playlist.m3u8) и подписывается
 * на каталог видео через token_path. Плеер запрашивает варианты и сегменты по
 * относительным путям, и они наследуют токен из пути. Токен в query-строке защитил бы
 * только сам плейлист: следующий запрос плеера ушёл бы без него и получил 403.
 *
 * Модуль серверный: ключ подписи не должен попасть в клиентский бандл.
 */
import { createHmac } from "node:crypto";

export interface SignCdnUrlOptions {
  /** Хост pull zone без протокола, например vz-xxxxxxxx-xxx.b-cdn.net. */
  hostname: string;
  /** Путь файла от корня зоны, уже URL-кодированный: /<videoId>/playlist.m3u8. */
  path: string;
  /** Token Authentication Key из настроек pull zone. */
  securityKey: string;
  /** Момент истечения, unix-время в секундах. */
  expiresAt: number;
  /** Префикс пути, на который действует токен. Без него токен действует только на path. */
  tokenPath?: string;
  /** true — токен в пути (нужно для HLS), false — в query-строке. */
  tokenInPath: boolean;
}

export function signCdnUrl(options: SignCdnUrlOptions): string {
  const { hostname, path, securityKey, expiresAt, tokenPath, tokenInPath } = options;
  if (securityKey === "") {
    throw new Error("Bunny: пустой ключ подписи");
  }
  if (!path.startsWith("/")) {
    throw new Error(`Bunny: путь должен начинаться с /, получено ${path}`);
  }

  const expires = String(Math.floor(expiresAt));
  // Параметры входят в подпись отсортированными по ключу; сейчас он один — token_path.
  const signingData = tokenPath ? `token_path=${tokenPath}` : "";
  const urlData = tokenPath ? `&token_path=${encodeURIComponent(tokenPath)}` : "";

  // Порядок полей в HMAC фиксирован эталоном: путь подписи, expires, IP (не используем), параметры.
  const digest = createHmac("sha256", securityKey)
    .update(tokenPath ?? path)
    .update(expires)
    .update(signingData)
    .digest("base64url");
  const token = `HS256-${digest}`;

  return tokenInPath
    ? `https://${hostname}/bcdn_token=${token}${urlData}&expires=${expires}${path}`
    : `https://${hostname}${path}?token=${token}${urlData}&expires=${expires}`;
}

export interface SignedPlaylistOptions {
  hostname: string;
  securityKey: string;
  videoId: string;
  expiresAt: number;
}

/** Мастер-плейлист видео Bunny Stream; токен действует на весь каталог видео. */
export function signedPlaylistUrl({ hostname, securityKey, videoId, expiresAt }: SignedPlaylistOptions): string {
  return signCdnUrl({
    hostname,
    securityKey,
    expiresAt,
    path: `/${videoId}/playlist.m3u8`,
    tokenPath: `/${videoId}/`,
    tokenInPath: true,
  });
}
