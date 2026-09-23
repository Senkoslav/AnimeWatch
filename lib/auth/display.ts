/**
 * Куки входа и показная кука `aw_user`. Модуль общий для сервера и браузера, поэтому в нём нет
 * ничего серверного: только имена и кодирование.
 *
 * Зачем две куки. Сессия (`aw_session`) — httpOnly, её читает только сервер. Но если шапка будет
 * читать её на сервере, корневой лэйаут станет динамическим, и ISR главной и тайтлов пропадёт.
 * Поэтому рядом лежит `aw_user`: имя, e-mail и аватар для шапки, без всякого секрета. Подделать её
 * можно, но это меняет только то, что человек видит у себя: права проверяются по `aw_session`.
 */

export const SESSION_COOKIE = "aw_session";
export const USER_COOKIE = "aw_user";
export const OAUTH_COOKIE = "aw_oauth";

/** Сессия живёт 30 дней с момента входа. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface DisplayUser {
  name: string | null;
  email: string;
  /** Только аватар Google: чужой адрес из поддельной куки на страницу не попадёт. */
  avatarUrl: string | null;
}

const AVATAR_HOST = /^lh\d+\.googleusercontent\.com$/;

function safeAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && AVATAR_HOST.test(url.hostname) ? url.href : null;
  } catch {
    // Не адрес — значит, аватара нет; показываем инициал.
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Значение показной куки: base64url от JSON — кириллица в имени иначе не пережила бы заголовок. */
export function encodeDisplayUser(user: DisplayUser): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify({ n: user.name, e: user.email, a: user.avatarUrl })));
}

/** Разбор показной куки. Любой мусор — null, как будто человек не вошёл. */
export function decodeDisplayUser(value: string | undefined | null): DisplayUser | null {
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
    if (typeof data !== "object" || data === null) return null;
    const { n, e, a } = data as Record<string, unknown>;
    if (typeof e !== "string" || e.length === 0) return null;
    return { name: typeof n === "string" && n.trim() ? n.trim() : null, email: e, avatarUrl: safeAvatar(a) };
  } catch {
    // Поддельная или битая кука: для шапки это «не вошёл», прав она всё равно не даёт.
    return null;
  }
}

/** Значение куки из строки document.cookie. */
export function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
