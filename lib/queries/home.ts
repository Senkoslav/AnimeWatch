import { prisma } from "@/lib/db";
import { formatAirTime } from "@/lib/format";
import { TitleStatus, type TitleKind } from "@/lib/generated/prisma/enums";
import { publicEpisodeWhere, publicTitleWhere } from "@/lib/public-where";
import { isDefined } from "@/lib/unknown";

/** Карточек в ленте «Свежее», не считая героя. */
const FEED_SIZE = 12;

export interface Release {
  episodeId: string;
  number: number;
  name: string | null;
  thumbUrl: string | null;
  publishedAt: Date;
  title: {
    slug: string;
    nameRu: string;
    /** Оригинальное название — подпись под заголовком промо. */
    name: string;
    description: string | null;
    posterUrl: string | null;
    kind: TitleKind;
    year: number | null;
    score: number | null;
  };
}

export interface HomeFeed {
  /** Самая свежая серия на сайте; null, если опубликованных серий нет. */
  hero: Release | null;
  /** Следующие тайтлы по дате последней серии, по одной карточке на тайтл. */
  releases: Release[];
}

export async function getHomeFeed(): Promise<HomeFeed> {
  // Одна строка на тайтл считается в базе: пакетная публикация (импорт, дюжина серий разом) иначе вытеснила бы
  // остальные тайтлы из окна последних серий. titleId в сортировке — чтобы герой не прыгал при равных датах.
  const latestByTitle = await prisma.episode.groupBy({
    by: ["titleId"],
    where: publicEpisodeWhere(),
    _max: { publishedAt: true },
    orderBy: [{ _max: { publishedAt: "desc" } }, { titleId: "asc" }],
    take: FEED_SIZE + 1,
  });
  if (latestByTitle.length === 0) {
    return { hero: null, releases: [] };
  }

  const episodes = await prisma.episode.findMany({
    where: {
      AND: [
        publicEpisodeWhere(),
        { OR: latestByTitle.map(({ titleId, _max }) => ({ titleId, publishedAt: _max.publishedAt })) },
      ],
    },
    // Несколько серий тайтла вышли одновременно: показываем старшую.
    orderBy: { number: "desc" },
    select: {
      id: true,
      titleId: true,
      number: true,
      name: true,
      thumbUrl: true,
      publishedAt: true,
      title: {
        select: {
          slug: true,
          nameRu: true,
          name: true,
          description: true,
          posterUrl: true,
          kind: true,
          year: true,
          score: true,
        },
      },
    },
  });

  const byTitle = new Map<string, Release>();
  for (const { id, titleId, publishedAt, ...episode } of episodes) {
    if (publishedAt === null || byTitle.has(titleId)) continue;
    byTitle.set(titleId, { ...episode, episodeId: id, publishedAt });
  }

  const [hero = null, ...releases] = latestByTitle.map(({ titleId }) => byTitle.get(titleId)).filter(isDefined);
  return { hero, releases };
}

/** Тайтл в блоках «Сейчас выходит» и «Расписание». */
export interface OngoingTitle {
  slug: string;
  nameRu: string;
  posterUrl: string | null;
  score: number | null;
  totalEpisodes: number | null;
  /** День выхода, 1 — понедельник. null — Shikimori его не знает, и в расписание тайтл не попадёт. */
  airDay: number | null;
  /** Сколько серий уже опубликовано у нас: «7 из 28» и «следующая — 8». */
  published: number;
  /** Следующая серия по данным Shikimori на момент импорта. Показывается временем, не датой. */
  nextEpisodeAt: Date | null;
}

const ONGOING_SELECT = {
  slug: true,
  nameRu: true,
  posterUrl: true,
  score: true,
  totalEpisodes: true,
  airDay: true,
  nextEpisodeAt: true,
  // Счётчик в том же запросе, а не запрос на тайтл.
  _count: { select: { episodes: { where: { publishedAt: { not: null } } } } },
} as const;

function toOngoing({ _count, ...title }: { _count: { episodes: number } } & Omit<OngoingTitle, "published">) {
  return { ...title, published: _count.episodes };
}

function ongoingWhere() {
  // AND, а не слияние объектов: статус ONGOING не должен перезаписать «не HIDDEN» из publicTitleWhere.
  return { AND: [publicTitleWhere(), { status: TitleStatus.ONGOING }] };
}

/**
 * «Сейчас выходит»: онгоинги по популярности у Shikimori, неизвестный ранг — в конец. Плюс общее
 * число: блок говорит, сколько всего выходит, а показывает только первый ряд.
 */
export async function getOngoing(limit: number): Promise<{ titles: OngoingTitle[]; total: number }> {
  const [titles, total] = await Promise.all([
    prisma.title.findMany({
      where: ongoingWhere(),
      orderBy: [{ popularityRank: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: limit,
      select: ONGOING_SELECT,
    }),
    prisma.title.count({ where: ongoingWhere() }),
  ]);
  return { titles: titles.map(toOngoing), total };
}

/**
 * Расписание: онгоинги с известным днём выхода, по дням недели. Внутри дня — по времени выхода по
 * Москве; без времени — в конце, по популярности.
 */
export async function getSchedule(): Promise<Map<number, OngoingTitle[]>> {
  const titles = await prisma.title.findMany({
    where: { AND: [ongoingWhere(), { airDay: { gte: 1, lte: 7 } }] },
    orderBy: [{ popularityRank: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    select: ONGOING_SELECT,
  });

  const byDay = new Map<number, OngoingTitle[]>();
  for (const title of titles.map(toOngoing)) {
    if (title.airDay === null) continue;
    byDay.set(title.airDay, [...(byDay.get(title.airDay) ?? []), title]);
  }
  // Время суток по Москве строкой «17:15» сравнивается как есть; сортировка устойчивая, поэтому
  // у равных остаётся порядок популярности из запроса.
  for (const day of byDay.values()) {
    day.sort((a, b) => airTimeKey(a).localeCompare(airTimeKey(b)));
  }
  return byDay;
}

/** Тайтл в списке «Популярное за всё время». */
export interface PopularTitle {
  slug: string;
  nameRu: string;
  posterUrl: string | null;
  kind: TitleKind;
  year: number | null;
  score: number | null;
  popularityRank: number;
}

/**
 * «Популярное за всё время»: место в списке Shikimori. Ранг есть только у тайтлов из пакетного
 * импорта (docs/03), поэтому без ранга тайтл сюда не попадает, а не встаёт в голову списка.
 */
export async function getPopular(limit: number): Promise<PopularTitle[]> {
  const titles = await prisma.title.findMany({
    where: { AND: [publicTitleWhere(), { popularityRank: { not: null } }] },
    orderBy: [{ popularityRank: "asc" }, { id: "asc" }],
    take: limit,
    select: { slug: true, nameRu: true, posterUrl: true, kind: true, year: true, score: true, popularityRank: true },
  });
  return titles.flatMap(({ popularityRank, ...title }) => (popularityRank === null ? [] : [{ ...title, popularityRank }]));
}

/** Ключ сортировки внутри дня: время по Москве, а без времени — после всех. */
function airTimeKey(title: OngoingTitle): string {
  return title.nextEpisodeAt ? formatAirTime(title.nextEpisodeAt) : "99:99";
}
