/**
 * Наполнение каталога метаданными из Shikimori. Запускается человеком, не сервисом: наполнение —
 * редкая операция (docs/02, «Компоненты»).
 *
 * Примеры:
 *   pnpm import:shikimori --top 150
 *   pnpm import:shikimori --ongoing
 *   pnpm import:shikimori --similar          # «похожие» для всего каталога, по запросу на тайтл
 *   pnpm import:shikimori 21 https://shikimori.io/animes/z52991-sousou-no-frieren
 *
 * Пишет в базу из DIRECT_URL (или DATABASE_URL). Перед записью печатает хост — чтобы случайный
 * прогон по проду был виден до того, как что-то изменится.
 */
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { createShikimoriClient, MAX_PAGE_SIZE } from "../lib/shikimori/client";
import { importSimilar, importTitles, resetPopularityRanks, type ImportStats } from "../lib/shikimori/import";
import type { AnimeNode } from "../lib/shikimori/schema";
import { PrismaClient } from "../lib/generated/prisma/client";

/** В каталог берём только то, что смотрят: клипы, промо и рекламу их API отдаёт теми же запросами. */
const CATALOG_KINDS = "tv,movie,ova,ona,special";

interface Args {
  top: number;
  ongoing: boolean;
  ids: number[];
  /** Проход «похожих» по всем тайтлам каталога: по запросу на тайтл, отдельно от метаданных. */
  similar: boolean;
}

/** Ссылка вида https://shikimori.io/animes/z52991-sousou-no-frieren — id может идти с буквой. */
function parseId(value: string): number | null {
  const fromUrl = /animes\/[a-z]?(\d+)/.exec(value);
  const raw = fromUrl?.[1] ?? value;
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { top: 0, ongoing: false, ids: [], similar: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--top") {
      const value = Number(argv[(i += 1)]);
      if (!Number.isInteger(value) || value <= 0) throw new Error("--top ждёт положительное число");
      args.top = value;
    } else if (arg === "--ongoing") {
      args.ongoing = true;
    } else if (arg === "--similar") {
      args.similar = true;
    } else if (arg?.startsWith("--")) {
      throw new Error(`неизвестный ключ ${arg}`);
    } else if (arg) {
      const id = parseId(arg);
      if (id === null) throw new Error(`не похоже на id или ссылку Shikimori: ${arg}`);
      args.ids.push(id);
    }
  }

  // Только --similar — значит, метаданные не трогаем: проходим «похожими» по тому, что уже в базе.
  if (args.top === 0 && !args.ongoing && args.ids.length === 0 && !args.similar) args.top = 100;
  return args;
}

function connectionString(): string {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("не задан DIRECT_URL или DATABASE_URL");
  return url;
}

interface Collected {
  nodes: AnimeNode[];
  /** Место в списке Shikimori по популярности, по shikimoriId. Пусто, если --top не просили. */
  ranks: Map<number, number>;
}

async function collect(args: Args, log: (message: string) => void): Promise<Collected> {
  const client = createShikimoriClient({ onRetry: log });
  const nodes = new Map<number, AnimeNode>();
  const ranks = new Map<number, number>();

  if (args.ids.length > 0) {
    log(`Запрашиваю ${args.ids.length} тайтлов по id`);
    for (const anime of await client.animes({ ids: args.ids, limit: args.ids.length })) {
      nodes.set(anime.id, anime);
    }
  }

  if (args.ongoing) {
    log("Запрашиваю текущие онгоинги");
    for (let page = 1; page <= 4; page += 1) {
      const batch = await client.animes({
        limit: MAX_PAGE_SIZE,
        page,
        order: "popularity",
        kind: CATALOG_KINDS,
        status: "ongoing",
      });
      batch.forEach((anime) => nodes.set(anime.id, anime));
      if (batch.length < MAX_PAGE_SIZE) break;
    }
  }

  if (args.top > 0) {
    const pages = Math.ceil(args.top / MAX_PAGE_SIZE);
    let collected = 0;
    for (let page = 1; page <= pages; page += 1) {
      log(`Популярное, страница ${page} из ${pages}`);
      // Страницы всегда полные. Смещение у них — (page - 1) * limit, поэтому «--top 60» с limit 10
      // на второй странице вернул бы снова тайтлы 11–20 и выдал бы им чужие номера 51–60.
      // Лишнее отрезаем после цикла, а не сужением limit.
      const batch = await client.animes({ limit: MAX_PAGE_SIZE, page, order: "popularity", kind: CATALOG_KINDS });

      // Номер — позиция в том, что вернул клиент. Узел со сломанным полем он отбрасывает при разборе,
      // и тогда следующие за ним сдвигаются на единицу: цена — порядок показа, а не потеря тайтла.
      for (const [index, anime] of batch.entries()) {
        const rank = (page - 1) * MAX_PAGE_SIZE + index + 1;
        if (rank > args.top) break;
        nodes.set(anime.id, anime);
        ranks.set(anime.id, rank);
      }

      collected += batch.length;
      if (batch.length < MAX_PAGE_SIZE || collected >= args.top) break;
    }
  }

  return { nodes: [...nodes.values()], ranks };
}

function report(stats: ImportStats, total: number): void {
  console.log(
    `Готово: получено ${total}, создано ${stats.created}, обновлено ${stats.updated}, ` +
      `серий заведено ${stats.episodesCreated}, пропущено ${stats.skipped}`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = connectionString();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  // Хост печатаем, содержимое строки — никогда: в ней пароль.
  console.log(`База: ${new URL(url).host}`);

  try {
    if (args.top > 0 || args.ongoing || args.ids.length > 0) {
      const { nodes, ranks } = await collect(args, (message) => console.log(message));
      if (nodes.length === 0) {
        console.log("Shikimori ничего не вернул, база не тронута");
      } else {
        // Места переписываем целиком, а не поверх: выпавший из топа тайтл иначе навсегда остался бы в голове.
        if (ranks.size > 0) {
          const cleared = await resetPopularityRanks(prisma);
          console.log(`Места по популярности сброшены у ${cleared}, проставляю заново ${ranks.size}`);
        }
        report(await importTitles(prisma, nodes, new Date(), ranks), nodes.length);
      }
    }
    if (args.similar) {
      console.log("Похожие: по запросу на тайтл, это несколько минут");
      const stats = await importSimilar(prisma, createShikimoriClient({ onRetry: console.log }), console.log);
      console.log(`Похожие: тайтлов ${stats.titles}, связей ${stats.relations}, не получено ${stats.failed}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
