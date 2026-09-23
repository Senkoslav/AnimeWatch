/**
 * Запись импортированных тайтлов в базу. Отдельно от CLI и от клиента: это единственное место,
 * где импорт трогает данные, и его можно проверить тестами на тестовой базе.
 *
 * Клиент передаётся снаружи, а не берётся из `lib/db.ts`: тот помечен `server-only` и в обычном
 * node-скрипте падает при импорте, а импорт запускают именно скриптом.
 */
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { TitleStatus } from "@/lib/generated/prisma/enums";

import { mapTitle, type MappedTitle } from "./map";
import type { AnimeNode } from "./schema";
import { buildSlug } from "./slug";

export interface ImportStats {
  created: number;
  updated: number;
  episodesCreated: number;
  /** Тайтлы, которые в каталог не берём: клипы, реклама, неизвестный статус. */
  skipped: number;
}

/** Свободный slug: базовый, иначе с годом, иначе с id. Занятые проверяются в базе, а не на глаз. */
async function freeSlug(prisma: PrismaClient, mapped: MappedTitle): Promise<string> {
  const taken = new Set<string>();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = buildSlug(
      { english: mapped.synonyms[0], name: mapped.name, year: mapped.year, shikimoriId: mapped.shikimoriId },
      taken,
    );
    const existing = await prisma.title.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    taken.add(candidate);
  }
  return `anime-${mapped.shikimoriId}`;
}

async function importOne(
  prisma: PrismaClient,
  mapped: MappedTitle,
  now: Date,
  popularityRank: number | null,
): Promise<{ created: boolean; episodesCreated: number }> {
  const existing = await prisma.title.findUnique({
    where: { shikimoriId: mapped.shikimoriId },
    select: { id: true, status: true },
  });

  const fields = {
    name: mapped.name,
    nameRu: mapped.nameRu,
    synonyms: mapped.synonyms,
    description: mapped.description,
    posterUrl: mapped.posterUrl,
    kind: mapped.kind,
    // Скрытие по жалобе правообладателя импорт не отменяет: иначе повторный прогон вернул бы тайтл на сайт.
    status: existing?.status === TitleStatus.HIDDEN ? TitleStatus.HIDDEN : mapped.status,
    year: mapped.year,
    season: mapped.season,
    ageRating: mapped.ageRating,
    genres: mapped.genres,
    score: mapped.score,
    // Ранг известен только пакетному импорту по популярности. Импорт по id его не знает и потому
    // не трогает: иначе точечное обновление одного тайтла стёрло бы порядок, собранный пакетом.
    ...(popularityRank === null ? {} : { popularityRank }),
    totalEpisodes: mapped.totalEpisodes,
    // Оба поля пишутся всегда, в том числе null: вышедший тайтл обязан уйти из расписания.
    nextEpisodeAt: mapped.nextEpisodeAt,
    airDay: mapped.airDay,
    // satisfies, а не просто объект: поле, которого нет в схеме, иначе проходит tsc и падает только в рантайме.
  } satisfies Prisma.TitleUpdateInput;

  const title = existing
    ? // publishedAt при обновлении не трогаем: черновик остаётся черновиком.
      await prisma.title.update({ where: { id: existing.id }, data: fields, select: { id: true } })
    : await prisma.title.create({
        data: {
          ...fields,
          shikimoriId: mapped.shikimoriId,
          slug: await freeSlug(prisma, mapped),
          publishedAt: now,
        },
        select: { id: true },
      });

  const episodesCreated = await syncEpisodes(prisma, title.id, mapped, now);
  return { created: !existing, episodesCreated };
}

/**
 * Доводит число серий до вышедших. Существующие серии не трогаются: их `publishedAt` — это время
 * появления серии у нас, и повторный импорт не должен переставлять его на сегодня.
 */
async function syncEpisodes(prisma: PrismaClient, titleId: string, mapped: MappedTitle, now: Date): Promise<number> {
  if (mapped.episodeCount <= 0) return 0;

  const existing = await prisma.episode.findMany({ where: { titleId }, select: { number: true } });
  const known = new Set(existing.map((episode) => episode.number));

  const missing = [];
  for (let number = 1; number <= mapped.episodeCount; number += 1) {
    if (!known.has(number)) {
      missing.push({ titleId, number, duration: mapped.episodeSeconds, publishedAt: now });
    }
  }
  if (missing.length === 0) return 0;

  const { count } = await prisma.episode.createMany({ data: missing, skipDuplicates: true });
  return count;
}

/**
 * Снять все места перед пакетным импортом по популярности. Без этого тайтл, выпавший из топа,
 * навсегда остаётся со старым номером: он сталкивается с новым владельцем места и вечно висит в
 * голове сортировки. Ранг — производная от их списка, и потерять его между двумя шагами не страшно:
 * следующая же строка импорта проставит номера заново, а упавший прогон чинится повторным запуском.
 */
export async function resetPopularityRanks(prisma: PrismaClient): Promise<number> {
  const { count } = await prisma.title.updateMany({
    where: { popularityRank: { not: null } },
    data: { popularityRank: null },
  });
  return count;
}

/**
 * Импорт пачки тайтлов. `now` — время появления у нас: дат выхода серий Shikimori не отдаёт,
 * поэтому `publishedAt` серии означает «добавлено на сайт», а не «вышло в эфир» (docs/06).
 *
 * `ranks` — места в списке Shikimori по популярности, по `shikimoriId`. Картой, а не позицией в
 * массиве: вызывающий склеивает тайтлы из нескольких запросов, и порядок массива уже не их.
 * Тайтла нет в карте — ранг неизвестен, и тогда он не трогается.
 */
export async function importTitles(
  prisma: PrismaClient,
  nodes: AnimeNode[],
  now: Date = new Date(),
  ranks: ReadonlyMap<number, number> = new Map(),
): Promise<ImportStats> {
  const stats: ImportStats = { created: 0, updated: 0, episodesCreated: 0, skipped: 0 };

  for (const node of nodes) {
    const rank = ranks.get(node.id) ?? null;

    const mapped = mapTitle(node);
    if (!mapped) {
      stats.skipped += 1;
      continue;
    }

    const { created, episodesCreated } = await importOne(prisma, mapped, now, rank);
    if (created) stats.created += 1;
    else stats.updated += 1;
    stats.episodesCreated += episodesCreated;
  }

  return stats;
}
