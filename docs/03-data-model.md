# 03. Модель данных

Схема — источник правды. Меняешь модель здесь и в `prisma/schema.prisma`
одновременно, иначе доки врут уже на второй неделе.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
}
datasource db { provider = "postgresql" }   // URL — в prisma.config.ts

enum TitleStatus   { ONGOING  COMPLETED  ANNOUNCED  HIDDEN }
enum TitleKind     { TV  MOVIE  OVA  ONA  SPECIAL }
enum SourceType    { HLS  MP4  TELEGRAM  VK  EXTERNAL }
enum IngestStatus  { PENDING  DOWNLOADING  UPLOADING  ENCODING  READY  FAILED }
enum Role          { USER  EDITOR  ADMIN }
enum WatchState    { WATCHING  PLANNED  COMPLETED  DROPPED }

model Title {
  id            String      @id @default(cuid())
  slug          String      @unique
  shikimoriId   Int?        @unique
  name          String                    // ромадзи/оригинал
  nameRu        String
  synonyms      String[]                  // для поиска
  description   String?     @db.Text
  posterUrl     String?
  bannerUrl     String?
  kind          TitleKind   @default(TV)
  status        TitleStatus @default(ONGOING)
  year          Int?
  season        String?
  ageRating     String?
  genres        String[]
  totalEpisodes Int?                      // сколько всего в тайтле
  airDay        Int?                      // 1-7, для расписания
  publishedAt   DateTime?                 // null = черновик; HIDDEN — только жалоба
  episodes      Episode[]
  credits       Credit[]
  bookmarks     Bookmark[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([status, updatedAt])
  @@index([publishedAt])
  @@index([year])
}

model Episode {
  id          String    @id @default(cuid())
  titleId     String
  title       Title     @relation(fields: [titleId], references: [id], onDelete: Cascade)
  number      Int
  name        String?
  description String?
  thumbUrl    String?
  duration    Int?                        // секунды, из Bunny после энкода
  publishedAt DateTime?                   // null = черновик, не виден зрителю
  sources     Source[]
  ingest      IngestJob?
  progress    Progress[]
  createdAt   DateTime  @default(now())

  @@unique([titleId, number])
  @@index([publishedAt])
}

// Один эпизод — несколько источников. Плеер берёт isDefault, затем остальные
// по приоритету. Это то, что позволяет переезжать между хостингами без правок UI.
model Source {
  id         String     @id @default(cuid())
  episodeId  String
  episode    Episode    @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  type       SourceType
  url        String                       // bunny videoId, iframe src или .m3u8
  quality    String?                      // "1080p"; null для адаптивного HLS
  isDefault  Boolean    @default(false)
  priority   Int        @default(100)

  @@index([episodeId, priority])
}

// Состояние конвейера «телеграм → bunny». Отдельно от Episode,
// чтобы падение импорта не ломало карточку серии.
model IngestJob {
  id            String       @id @default(cuid())
  episodeId     String       @unique
  episode       Episode      @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  tgChatId      String
  tgMessageId   Int
  bunnyVideoId  String?
  status        IngestStatus @default(PENDING)
  progress      Int          @default(0)   // 0-100
  error         String?
  attempts      Int          @default(0)
  startedAt     DateTime?
  finishedAt    DateTime?
  createdAt     DateTime     @default(now())

  @@index([status])
}

model Member {
  id        String   @id @default(cuid())
  slug      String   @unique
  nickname  String
  avatarUrl String?
  bio       String?
  tgUrl     String?
  credits   Credit[]
  sortOrder Int      @default(100)
}

model Credit {
  id       String  @id @default(cuid())
  titleId  String
  title    Title   @relation(fields: [titleId], references: [id], onDelete: Cascade)
  memberId String
  member   Member  @relation(fields: [memberId], references: [id], onDelete: Cascade)
  role     String                          // "Наруто", "Звукорежиссёр", "Перевод"
  isVoice  Boolean @default(true)

  @@index([titleId])
  @@index([memberId])
}

model User {
  id         String     @id @default(cuid())
  tgId       BigInt     @unique
  username   String?
  firstName  String?
  avatarUrl  String?
  role       Role       @default(USER)
  bookmarks  Bookmark[]
  progress   Progress[]
  createdAt  DateTime   @default(now())
}

model Bookmark {
  userId   String
  user     User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  titleId  String
  title    Title      @relation(fields: [titleId], references: [id], onDelete: Cascade)
  state    WatchState @default(WATCHING)
  addedAt  DateTime   @default(now())

  @@id([userId, titleId])
  @@index([userId, state])
  @@index([titleId])
}

model Progress {
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  episodeId String
  episode   Episode  @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  seconds   Int      @default(0)
  completed Boolean  @default(false)
  updatedAt DateTime @updatedAt

  @@id([userId, episodeId])
  @@index([userId, updatedAt])
  @@index([episodeId])
}

model News {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  cover       String?
  body        String    @db.Text          // markdown
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
}
```

## Правила работы со схемой

- `publishedAt = null` означает черновик — у тайтла, серии и новости. Публичные
  запросы **всегда** фильтруют `publishedAt != null` и `status != HIDDEN`.
  Хелперы `publicTitleWhere()` / `publicEpisodeWhere()` в `lib/public-where.ts`,
  публичные выборки идут только через них. Серия публична, только если публичен
  и её тайтл.
- `Title.status = HIDDEN` — рубильник по жалобе правообладателя. Скрывает тайтл
  и все его серии, ничего не удаляя. Для черновиков его не используем: снятие
  жалобы не должно случайно опубликовать недозаполненный тайтл.
- Прогресс пишем не чаще раза в 10 секунд и на `pause`/`ended`/уходе со страницы
  через `sendBeacon`. Неавторизованным — в память вкладки, без записи в БД.
- Postgres не индексирует внешние ключи сам. У каждого FK, который не стоит
  первым в составном ключе, есть свой `@@index`: иначе каскадное удаление тайтла
  или серии сканирует `Progress` целиком.
- `BigInt` для `tgId` не сериализуется в JSON по умолчанию — приводи к строке на
  границе, иначе поймаешь рантайм-ошибку в server action.

## Prisma 7: как устроено подключение

Версия 7.10 (почему не 8 — в `docs/02`, «Версии»).

- **Два URL.** `DATABASE_URL` — через пулер, им пользуется приложение
  (`lib/db.ts`, driver adapter `@prisma/adapter-pg`). `DIRECT_URL` — прямое
  соединение для CLI: миграции через pgbouncer не работают. Локально оба
  указывают на одну базу.
- **`prisma.config.ts`** держит путь к схеме, миграциям, команду seed и
  `DIRECT_URL`. `.env` Prisma сама не читает: конфиг подгружает `.env.local`,
  если файл есть.
- **Клиент генерируется** в `lib/generated/prisma` (в git не попадает) на
  `postinstall`. Импорт в приложении — только `prisma` из `lib/db.ts`: модуль
  помечен `server-only`, и импорт из клиентского компонента роняет сборку.
- **Seed** (`prisma/seed.ts`) идемпотентен и пишет только в локальную базу.
  Для удалённой нужен явный `SEED_ALLOW_REMOTE=1`.
- **Прод** применяет миграции `pnpm db:deploy`; `db:migrate` — только локально,
  ему нужна shadow-база.
- **Пул в serverless.** Сейчас `PrismaPg` сам создаёт `pg.Pool` с настройками по
  умолчанию (до 10 соединений). Vercel замораживает инстанс вместе с открытыми
  соединениями, и после разморозки первый запрос может попасть в оборванный
  сокет. До прода: явный `pg.Pool` с маленьким `max` и коротким
  `idleTimeoutMillis`, плюс `attachDatabasePool` из `@vercel/functions`.
- У `pg` по умолчанию нет таймаута соединения, поэтому в `lib/db.ts` заданы
  `connectionTimeoutMillis` (5 с) и `query_timeout` (15 с).
- `lib/db.ts` проверяет `DATABASE_URL` при импорте, поэтому `next build` страниц
  с запросами требует этот env и в CI.
- Локально стоит Postgres 14 из Homebrew, на проде будет новее. Схема не
  использует ничего версии-специфичного; расширения (например, `pg_trgm` для
  поиска) проверять на обеих.
