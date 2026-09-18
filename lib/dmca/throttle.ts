/**
 * Лимит на поток обращений. Форма публичная: роль проверить нельзя, значит нужен хотя бы предел
 * на один источник. Адреса заявителей в базе не нужны, поэтому в строке лежит только соль+хеш.
 */
import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";

/** Больше этого за час с одного адреса — почти наверняка не правообладатель. */
export const MAX_REQUESTS_PER_HOUR = 5;

const WINDOW_MS = 60 * 60 * 1000;

/** Соль в dev своя: без неё sha256 от IPv4 перебирается за секунды, а падать локально незачем. */
function salt(): string {
  const configured = process.env.DMCA_IP_SALT;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DMCA_IP_SALT не задан: без соли хеш адреса заявителя обратим перебором");
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

export async function isOverLimit(ipHash: string): Promise<boolean> {
  const recent = await prisma.dmcaRequest.count({
    where: { ipHash, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  return recent >= MAX_REQUESTS_PER_HOUR;
}
