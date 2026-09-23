/** Случайные токены, хеши и PKCE. Только сервер: node:crypto. */
import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 случайных байта в base64url: токен сессии, state и code_verifier. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** То, что хранится в базе вместо токена сессии. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** code_challenge для PKCE S256 (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Сравнение без утечки по времени: state из адреса против state из куки. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
