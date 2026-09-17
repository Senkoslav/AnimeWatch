/**
 * Данные для локальной разработки: десять тайтлов, в том числе черновик и скрытый по жалобе.
 * Метаданные и постеры — из API Shikimori, описания есть только у первых двух.
 * Даты публикации считаются от момента запуска, чтобы на главной были и свежие, и старые серии.
 * Идемпотентен: повторный запуск возвращает записи к этому состоянию, дублей не создаёт.
 * Запуск: pnpm db:seed.
 */
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, SourceType, TitleKind, TitleStatus, type Prisma } from "../lib/generated/prisma/client";

interface SeedEpisode {
  number: number;
  name?: string;
  duration: number;
  /** Сколько часов назад вышла; null — черновик. */
  hoursAgo: number | null;
  /** Bunny videoId. Без него серия «ещё обрабатывается». */
  video?: string;
}

interface SeedTitle {
  data: Omit<Prisma.TitleCreateInput, "episodes" | "credits" | "bookmarks" | "publishedAt">;
  /** Сколько часов назад тайтл опубликован; null — черновик. */
  hoursAgo: number | null;
  episodes: SeedEpisode[];
  credits: { member: string; role: string; isVoice: boolean }[];
}

const SEEDED_AT = Date.now();
/**
 * Тестовое видео из библиотеки Bunny (фаза 0, docs/05): 12 секунд синтетики в 480/720/1080p. Играет с
 * подписанным URL на localhost:3000 — только этот origin разрешён в библиотеке. e2e подменяет CDN фикстурой.
 */
const TEST_VIDEO = "ee9ae3d2-b3d3-49e0-b2eb-2eb91ae6f381";
const HOUR = 60 * 60 * 1000;
const EPISODE_SECONDS = 1440;

function hoursAgo(hours: number | null): Date | null {
  return hours === null ? null : new Date(SEEDED_AT - hours * HOUR);
}

function poster(path: string): string {
  return `https://shikimori.io/system/animes/original/${path}`;
}

/** Серии подряд с одинаковой длительностью; часы — от первой к последней. */
function episodes(...hours: (number | null)[]): SeedEpisode[] {
  return hours.map((hoursAgo, index) => ({ number: index + 1, duration: EPISODE_SECONDS, hoursAgo }));
}

const MEMBERS: Prisma.MemberCreateInput[] = [
  { slug: "mika", nickname: "Мика", bio: "Голос героинь, которые старше всех в кадре.", sortOrder: 10 },
  { slug: "trek", nickname: "Трек", bio: "Сводит дорожки и следит, чтобы голос не тонул в музыке.", sortOrder: 20 },
];

const SOUND = { member: "trek", role: "Звукорежиссёр", isVoice: false };

const TITLES: SeedTitle[] = [
  {
    data: {
      slug: "frieren",
      shikimoriId: 52991,
      name: "Sousou no Frieren",
      nameRu: "Провожающая в последний путь Фрирен",
      synonyms: ["Фрирен", "Frieren: Beyond Journey's End"],
      // Длиннее порога «Ещё» на странице тайтла: e2e проверяет раскрытие описания.
      description:
        "Отряд героя победил Короля демонов и вернулся домой. Эльфийка-маг Фрирен проживёт ещё тысячу лет " +
        "и только теперь начинает понимать, как мало времени провела со спутниками. Она отправляется в новое " +
        "путешествие, чтобы узнать людей, которых успела потерять, и берёт в ученицы юную волшебницу Ферн.",
      posterUrl: poster("52991.jpg?1710731127"),
      kind: TitleKind.TV,
      status: TitleStatus.ONGOING,
      year: 2023,
      season: "fall",
      genres: ["Приключения", "Драма", "Фэнтези"],
      totalEpisodes: 28,
      airDay: 5,
    },
    hoursAgo: 240,
    episodes: [
      { number: 1, name: "Конец путешествия", duration: 1470, hoursAgo: 240, video: TEST_VIDEO },
      { number: 2, name: "Не обязательно магия", duration: 1440, hoursAgo: 120, video: TEST_VIDEO },
      { number: 3, name: "Магия убийства людей", duration: 1440, hoursAgo: 2, video: TEST_VIDEO },
      // Черновик: серия заведена, но зритель её не видит.
      { number: 4, name: "Земля, где покоятся души", duration: 1440, hoursAgo: null },
    ],
    credits: [{ member: "mika", role: "Фрирен", isVoice: true }, SOUND],
  },
  {
    data: {
      slug: "kaiju-no-8",
      shikimoriId: 52588,
      name: "Kaijuu 8-gou",
      nameRu: "Кайдзю №8",
      synonyms: ["Kaiju No. 8", "Кайдзю номер восемь"],
      description:
        "Кафка разбирает туши убитых кайдзю и давно отказался от мечты попасть в Силы обороны. " +
        "Пока однажды сам не превращается в чудовище.",
      posterUrl: poster("52588.jpg?1717955244"),
      kind: TitleKind.TV,
      status: TitleStatus.COMPLETED,
      year: 2024,
      season: "spring",
      genres: ["Экшен", "Фантастика"],
      totalEpisodes: 12,
    },
    hoursAgo: 400,
    episodes: [
      { number: 1, name: "Человек, ставший кайдзю", duration: 1420, hoursAgo: 400, video: TEST_VIDEO },
      // Опубликована, но видео нет: страница просмотра показывает «Серия ещё обрабатывается».
      { number: 2, name: "Кайдзю, который побеждает кайдзю", duration: 1420, hoursAgo: 30 },
    ],
    credits: [{ member: "mika", role: "Мина Асиро", isVoice: true }, SOUND],
  },
  {
    data: {
      slug: "jujutsu-kaisen-2",
      shikimoriId: 51009,
      name: "Jujutsu Kaisen 2nd Season",
      nameRu: "Магическая битва 2",
      synonyms: ["Jujutsu Kaisen Season 2"],
      posterUrl: poster("51009.jpg?1711334733"),
      kind: TitleKind.TV,
      status: TitleStatus.ONGOING,
      year: 2023,
      genres: ["Экшен", "Фэнтези", "Школа", "Сёнен"],
      totalEpisodes: 23,
    },
    hoursAgo: 200,
    episodes: episodes(200, 150, 50),
    credits: [SOUND],
  },
  {
    data: {
      slug: "dandadan",
      shikimoriId: 57334,
      name: "Dandadan",
      nameRu: "Дандадан",
      synonyms: ["Dan Da Dan"],
      posterUrl: poster("57334.jpg?1716838813"),
      kind: TitleKind.TV,
      status: TitleStatus.ONGOING,
      year: 2024,
      genres: ["Экшен", "Комедия", "Сверхъестественное", "Сёнен"],
      totalEpisodes: 12,
    },
    hoursAgo: 90,
    episodes: episodes(90, 5),
    credits: [SOUND],
  },
  {
    data: {
      slug: "kusuriya-no-hitorigoto",
      shikimoriId: 54492,
      name: "Kusuriya no Hitorigoto",
      nameRu: "Монолог фармацевта",
      synonyms: ["The Apothecary Diaries", "Записки аптекаря"],
      posterUrl: poster("54492.jpg?1718587512"),
      kind: TitleKind.TV,
      status: TitleStatus.ONGOING,
      year: 2023,
      genres: ["Драма", "Детектив", "Исторический"],
      totalEpisodes: 24,
    },
    hoursAgo: 70,
    episodes: episodes(70),
    credits: [SOUND],
  },
  {
    data: {
      slug: "kimi-no-na-wa",
      shikimoriId: 32281,
      name: "Kimi no Na wa.",
      nameRu: "Твоё имя",
      synonyms: ["Your Name."],
      posterUrl: poster("32281.jpg?1711958651"),
      kind: TitleKind.MOVIE,
      status: TitleStatus.COMPLETED,
      year: 2016,
      genres: ["Драма", "Сверхъестественное"],
      totalEpisodes: 1,
    },
    hoursAgo: 300,
    episodes: episodes(300),
    credits: [SOUND],
  },
  {
    // Самое длинное название: проверка, что карточка и герой его переносят.
    data: {
      slug: "mushoku-tensei-part-2",
      shikimoriId: 45576,
      name: "Mushoku Tensei: Isekai Ittara Honki Dasu Part 2",
      nameRu: "Реинкарнация безработного: История о приключениях в другом мире. Часть 2",
      synonyms: ["Mushoku Tensei: Jobless Reincarnation Part 2"],
      posterUrl: poster("45576.jpg?1711965124"),
      kind: TitleKind.TV,
      status: TitleStatus.COMPLETED,
      year: 2021,
      genres: ["Приключения", "Драма", "Фэнтези"],
      totalEpisodes: 12,
    },
    hoursAgo: 700,
    episodes: episodes(700, 20),
    credits: [SOUND],
  },
  {
    // Без постера: карточка должна держать пропорцию и без картинки.
    data: {
      slug: "chainsaw-man",
      shikimoriId: 44511,
      name: "Chainsaw Man",
      nameRu: "Человек-бензопила",
      synonyms: ["CSM"],
      kind: TitleKind.TV,
      status: TitleStatus.COMPLETED,
      year: 2022,
      genres: ["Экшен", "Фэнтези", "Сёнен"],
      totalEpisodes: 12,
    },
    hoursAgo: 100,
    episodes: episodes(100),
    credits: [SOUND],
  },
  {
    // Длинный сериал без видео: на нём проверяется поиск с опечаткой («наруот»).
    data: {
      slug: "naruto",
      shikimoriId: 20,
      name: "Naruto",
      nameRu: "Наруто",
      synonyms: ["NARUTO"],
      posterUrl: poster("20.jpg?1711965679"),
      kind: TitleKind.TV,
      status: TitleStatus.COMPLETED,
      year: 2002,
      genres: ["Экшен", "Приключения", "Фэнтези", "Боевые искусства", "Сёнен"],
      totalEpisodes: 220,
    },
    hoursAgo: 900,
    episodes: episodes(900, 890),
    credits: [SOUND],
  },
  {
    // Черновик тайтла со свежей опубликованной серией: если фильтр сломан, он станет героем главной.
    data: {
      slug: "spy-x-family",
      shikimoriId: 50265,
      name: "Spy x Family",
      nameRu: "Семья шпиона",
      synonyms: [],
      posterUrl: poster("50265.jpg?1716777040"),
      kind: TitleKind.TV,
      status: TitleStatus.ONGOING,
      year: 2022,
      genres: ["Сёнен", "Экшен", "Комедия"],
      totalEpisodes: 12,
    },
    hoursAgo: null,
    episodes: episodes(1),
    credits: [SOUND],
  },
  {
    // Скрыт по жалобе, самая свежая серия в базе: если фильтр сломан, он станет героем главной.
    data: {
      slug: "oshi-no-ko",
      shikimoriId: 52034,
      name: "[Oshi no Ko]",
      nameRu: "Ребёнок идола",
      synonyms: ["Ребёнок айдола"],
      posterUrl: poster("52034.jpg?1711937183"),
      kind: TitleKind.TV,
      status: TitleStatus.HIDDEN,
      year: 2023,
      genres: ["Драма", "Сверхъестественное", "Сэйнэн"],
      totalEpisodes: 11,
    },
    hoursAgo: 60,
    episodes: episodes(60, 0.5),
    credits: [SOUND],
  },
];

async function main(): Promise<void> {
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("нет DIRECT_URL или DATABASE_URL: добавь их в .env.local, образец в .env.example");
  }
  // Upsert по slug перезапишет настоящие тайтлы с такими же slug, поэтому чужую базу нужно подтвердить явно.
  // pg берёт хост из ?host=, если он есть, поэтому проверяем оба места.
  const url = new URL(connectionString);
  const host = url.searchParams.get("host") ?? url.hostname;
  // Путь вместо хоста — unix-сокет, то есть тоже локальная база.
  const isLocal = host.startsWith("/") || ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
  if (!isLocal && process.env.SEED_ALLOW_REMOTE !== "1") {
    throw new Error(
      `seed пишет в ${host}, а не в локальную базу. Если это точно нужно: SEED_ALLOW_REMOTE=1 pnpm db:seed`,
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function seed(prisma: PrismaClient): Promise<void> {
  const memberIds = new Map<string, string>();
  for (const member of MEMBERS) {
    const { id } = await prisma.member.upsert({ where: { slug: member.slug }, create: member, update: member });
    memberIds.set(member.slug, id);
  }

  for (const { data, hoursAgo: titleHoursAgo, episodes, credits } of TITLES) {
    await prisma.$transaction(async (tx) => {
      const fields = { ...data, publishedAt: hoursAgo(titleHoursAgo) };
      const title = await tx.title.upsert({ where: { slug: data.slug }, create: fields, update: fields });

      for (const { hoursAgo: episodeHoursAgo, video, ...episode } of episodes) {
        const episodeFields = { name: null, ...episode, publishedAt: hoursAgo(episodeHoursAgo) };
        const { id: episodeId } = await tx.episode.upsert({
          where: { titleId_number: { titleId: title.id, number: episode.number } },
          create: { ...episodeFields, titleId: title.id },
          update: episodeFields,
        });
        // У Source нет естественного ключа: источники серии пересоздаются целиком.
        await tx.source.deleteMany({ where: { episodeId } });
        if (video) {
          await tx.source.create({ data: { episodeId, type: SourceType.HLS, url: video, isDefault: true } });
        }
      }

      // У Credit нет естественного ключа, поэтому состав тайтла пересоздаётся целиком.
      await tx.credit.deleteMany({ where: { titleId: title.id } });
      await tx.credit.createMany({
        data: credits.map(({ member, role, isVoice }) => {
          const memberId = memberIds.get(member);
          if (!memberId) throw new Error(`seed: участник ${member} не найден в MEMBERS`);
          return { titleId: title.id, memberId, role, isVoice };
        }),
      });
    });
  }

  const [titles, episodeCount, drafts] = await Promise.all([
    prisma.title.count(),
    prisma.episode.count(),
    prisma.episode.count({ where: { publishedAt: null } }),
  ]);
  console.log(`Seed готов: тайтлов ${titles}, серий ${episodeCount}, из них черновиков ${drafts}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
