/**
 * Лимит на поток обращений. Форма публичная: роль проверить нельзя, значит нужен хотя бы предел
 * на один источник. Адреса заявителей в базе не нужны, поэтому в строке лежит только соль+хеш.
 */
import "server-only";

import { prisma } from "@/lib/db";

// Адрес и его хеш — общие с живым поиском (lib/client-ip.ts); отсюда реэкспорт для /dmca.
export { clientIp, hashIp } from "@/lib/client-ip";

/** Больше этого за час с одного адреса — почти наверняка не правообладатель. */
export const MAX_REQUESTS_PER_HOUR = 5;

const WINDOW_MS = 60 * 60 * 1000;

export async function isOverLimit(ipHash: string): Promise<boolean> {
  const recent = await prisma.dmcaRequest.count({
    where: { ipHash, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  return recent >= MAX_REQUESTS_PER_HOUR;
}
