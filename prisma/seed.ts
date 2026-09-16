/**
 * Данные для локальной разработки: два тайтла, шесть серий, одна из них черновик.
 * Идемпотентен: повторный запуск возвращает записи к этому состоянию, дублей не создаёт.
 * Запуск: pnpm db:seed.
 */
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, TitleKind, TitleStatus, type Prisma } from "../lib/generated/prisma/client";

interface SeedEpisode {
  number: number;
  name: string;
  duration: number;
  /** null — черновик. */
  publishedAt: string | null;
}

interface SeedTitle {
  data: Omit<Prisma.TitleCreateInput, "episodes" | "credits" | "bookmarks">;
  episodes: SeedEpisode[];
  credits: { member: string; role: string; isVoice: boolean }[];
}

const MEMBERS: Prisma.MemberCreateInput[] = [
  { slug: "mika", nickname: "Мика", bio: "Голос героинь, которые старше всех в кадре.", sortOrder: 10 },
  { slug: "trek", nickname: "Трек", bio: "Сводит дорожки и следит, чтобы голос не тонул в музыке.", sortOrder: 20 },
];

const TITLES: SeedTitle[] = [
  {
    data: {
      slug: "frieren",
      shikimoriId: 52991,
      name: "Sousou no Frieren",
      nameRu: "Провожающая в последний путь Фрирен",
      synonyms: ["Фрирен", "Frieren: Beyond Journey's End"],
      description:
        "Отряд героя победил Короля демонов. Эльфийка Фрирен проживёт ещё тысячу лет и только теперь " +
        "начинает понимать, как мало времени провела со спутниками.",
      kind: TitleKind.TV,
      status: TitleStatus.ONGOING,
      year: 2023,
      season: "fall",
      genres: ["Приключения", "Драма", "Фэнтези"],
      totalEpisodes: 28,
      airDay: 5,
      publishedAt: new Date("2026-09-01T18:00:00Z"),
    },
    episodes: [
      { number: 1, name: "Конец путешествия", duration: 1470, publishedAt: "2026-09-01T18:00:00Z" },
      { number: 2, name: "Не обязательно магия", duration: 1440, publishedAt: "2026-09-05T18:00:00Z" },
      { number: 3, name: "Магия убийства людей", duration: 1440, publishedAt: "2026-09-12T18:00:00Z" },
      // Черновик: серия заведена, но зритель её не видит.
      { number: 4, name: "Земля, где покоятся души", duration: 1440, publishedAt: null },
    ],
    credits: [
      { member: "mika", role: "Фрирен", isVoice: true },
      { member: "trek", role: "Звукорежиссёр", isVoice: false },
    ],
  },
  {
    data: {
      slug: "kaiju-no-8",
      shikimoriId: 52588,
      name: "Kaijuu 8-gou",
      nameRu: "Кайдзю №8",
      synonyms: ["Kaiju No. 8"],
      description:
        "Кафка разбирает туши убитых кайдзю и давно отказался от мечты попасть в Силы обороны. " +
        "Пока однажды сам не превращается в чудовище.",
      kind: TitleKind.TV,
      status: TitleStatus.COMPLETED,
      year: 2024,
      season: "spring",
      genres: ["Экшен", "Фантастика"],
      totalEpisodes: 12,
      publishedAt: new Date("2026-08-20T18:00:00Z"),
    },
    episodes: [
      { number: 1, name: "Человек, ставший кайдзю", duration: 1420, publishedAt: "2026-08-20T18:00:00Z" },
      { number: 2, name: "Кайдзю, который побеждает кайдзю", duration: 1420, publishedAt: "2026-08-27T18:00:00Z" },
    ],
    credits: [
      { member: "mika", role: "Мина Асиро", isVoice: true },
      { member: "trek", role: "Звукорежиссёр", isVoice: false },
    ],
  },
];

async function main(): Promise<void> {
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("нет DIRECT_URL или DATABASE_URL: добавь их в .env.local, образец в .env.example");
  }
  // Upsert по slug перезапишет настоящие тайтлы с такими же slug, поэтому чужую базу нужно подтвердить явно.
  const host = new URL(connectionString).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && process.env.SEED_ALLOW_REMOTE !== "1") {
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

  for (const { data, episodes, credits } of TITLES) {
    await prisma.$transaction(async (tx) => {
      const title = await tx.title.upsert({ where: { slug: data.slug }, create: data, update: data });

      for (const { publishedAt, ...episode } of episodes) {
        const fields = { ...episode, publishedAt: publishedAt === null ? null : new Date(publishedAt) };
        await tx.episode.upsert({
          where: { titleId_number: { titleId: title.id, number: episode.number } },
          create: { ...fields, titleId: title.id },
          update: fields,
        });
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

  const [titles, episodes, drafts] = await Promise.all([
    prisma.title.count(),
    prisma.episode.count(),
    prisma.episode.count({ where: { publishedAt: null } }),
  ]);
  console.log(`Seed готов: тайтлов ${titles}, серий ${episodes}, из них черновиков ${drafts}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
