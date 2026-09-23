import { randomInt } from "node:crypto";

import { prisma } from "@/lib/db";
import { publicTitleWhere } from "@/lib/public-where";

/**
 * Случайный публичный тайтл для /random. Два запроса вместо `ORDER BY random()`: сортировка всей
 * таблицы ради одной строки — это полный скан на каждое нажатие, а число плюс сдвиг — два быстрых
 * запроса. Порядок по id нужен, чтобы сдвиг указывал на одну и ту же строку в обоих запросах.
 *
 * null — публичных тайтлов нет вовсе.
 */
export async function getRandomTitleSlug(): Promise<string | null> {
  const total = await prisma.title.count({ where: publicTitleWhere() });
  if (total === 0) return null;

  const title = await prisma.title.findFirst({
    where: publicTitleWhere(),
    orderBy: { id: "asc" },
    skip: randomInt(total),
    select: { slug: true },
  });
  return title?.slug ?? null;
}
