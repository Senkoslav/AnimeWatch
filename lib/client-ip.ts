/**
 * Адрес посетителя и его хеш — для лимитов (/dmca, живой поиск). Сами адреса не храним нигде:
 * ни в базе, ни в Redis — только соль+хеш.
 */
import "server-only";

import { createHash } from "node:crypto";

/**
 * Соль обязательна в проде (scripts/vercel-build.sh не соберёт прод без неё): без неё sha256 от
 * IPv4 перебирается за секунды. Локально своя, падать незачем.
 */
function salt(): string {
  const configured = process.env.DMCA_IP_SALT;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DMCA_IP_SALT не задан: без соли хеш адреса посетителя обратим перебором");
  }
  return "dev-salt";
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${salt()}:${ip}`).digest("hex");
}

/** Адрес запроса: за прокси (Vercel) настоящий приходит в x-forwarded-for первым. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
