# 03. Модель данных

Схема — источник правды. Меняешь модель здесь и в `prisma/schema.prisma`
одновременно, иначе доки врут уже на второй неделе.

```prisma
generator client {
  provider        = "prisma-client"
  output          = "../lib/generated/prisma"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  // pg_trgm — поиск, устойчивый к опечаткам (docs/03, «Поиск»). Ставится миграцией, не руками.
  extensions = [pgTrgm(map: "pg_trgm")]
}

enum TitleStatus {
  ONGOING
  COMPLETED
  ANNOUNCED
  HIDDEN
}

enum TitleKind {
  TV
  MOVIE
  OVA
  ONA
  SPECIAL
}

enum SourceType {
  // Плеер Kodik во фрейме: основной источник (docs/05-kodik.md).
  KODIK
  // Про запас, когда появится второй поставщик: прямой файл или чужой фрейм.
  MP4
  HLS
  EXTERNAL
}

enum Role {
  USER
  ADMIN
}

// Связь тайтла с другим у Shikimori (lib/shikimori): «похожие» из их REST и франшиза из GraphQL.
// На них держатся рекомендации (lib/recommendations): «похоже на то, что вы оценили» и «продолжение».
enum RelationKind {
  SIMILAR
  SEQUEL
  PREQUEL
  SIDE_STORY
  OTHER
}

enum WatchState {
  WATCHING
  PLANNED
  // «Отложено», как on_hold у Shikimori (решение владельца 2026-09-24): начал и поставил на паузу.
  ON_HOLD
  COMPLETED
  DROPPED
}

model Title {
  id             String                    @id @default(cuid())
  slug           String                    @unique
  shikimoriId    Int?                      @unique
  name           String // ромадзи/оригинал
  nameRu         String
  synonyms       String[] // для поиска
  description    String?                   @db.Text
  posterUrl      String?
  bannerUrl      String?
  kind           TitleKind                 @default(TV)
  status         TitleStatus               @default(ONGOING)
  year           Int?
  season         String?
  ageRating      String?
  genres         String[]
  // Оценка Shikimori, 0–10. У тайтла без оценок их API отдаёт 0.0 — при импорте это становится null,
  // иначе анонс с нулём выглядит как худший тайтл каталога, а не как тайтл без оценки.
  score          Float?
  // Место в их списке по популярности на момент импорта: числового поля популярности в их API нет,
  // есть только сортировка. Известно поэтому лишь для тайтлов из пакетного импорта.
  popularityRank Int?
  totalEpisodes  Int? // сколько всего в тайтле
  airDay         Int? // 1-7 по Москве; выводится импортом из nextEpisodeAt
  // Следующая серия по данным Shikimori на момент импорта. Снимок: импорт запускается руками, поэтому
  // расписание показывает день и время («чт, 17:15»), а не дату, которая устареет через неделю.
  nextEpisodeAt  DateTime?
  publishedAt    DateTime? // null = черновик; HIDDEN — только рубильник по жалобе
  episodes       Episode[]
  bookmarks      Bookmark[]
  relations      TitleRelation[]
  dismissals     RecommendationDismissal[]
  createdAt      DateTime                  @default(now())
  updatedAt      DateTime                  @updatedAt

  @@index([status, updatedAt])
  @@index([publishedAt])
  @@index([year])
  @@index([score])
  @@index([popularityRank])
  // Триграммные индексы под поиск. Текущий запрос считает счёт выражением и идёт сканом;
  // индексы понадобятся, когда каталог вырастет и запрос перепишут на оператор % (docs/03).
  @@index([nameRu(ops: raw("gin_trgm_ops"))], type: Gin)
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin)
}

model Episode {
  id          String     @id @default(cuid())
  titleId     String
  title       Title      @relation(fields: [titleId], references: [id], onDelete: Cascade)
  number      Int
  name        String?
  description String?
  thumbUrl    String?
  duration    Int? // секунды, если источник их сообщает
  publishedAt DateTime? // null = черновик, не виден зрителю
  sources     Source[]
  progress    Progress[]
  createdAt   DateTime   @default(now())

  @@unique([titleId, number])
  @@index([publishedAt])
}

// Один эпизод — несколько источников. Страница просмотра берёт isDefault, затем остальные
// по приоритету. Это то, что позволяет сменить поставщика видео без правок UI.
model Source {
  id        String     @id @default(cuid())
  episodeId String
  episode   Episode    @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  type      SourceType
  url       String // src фрейма Kodik, ссылка на файл или .m3u8
  quality   String? // "1080p"; null для адаптивного HLS
  isDefault Boolean    @default(false)
  priority  Int        @default(100)

  @@index([episodeId, priority])
}

// Аккаунт — вход через Google (docs/02, «Вход»). googleId — поле `sub` из id_token: e-mail у человека
// может смениться, sub нет. E-mail не уникален по той же причине: он лишь подпись в меню профиля.
model User {
  id         String                    @id @default(cuid())
  googleId   String                    @unique
  email      String
  name       String?
  avatarUrl  String?
  role       Role                      @default(USER)
  sessions   Session[]
  bookmarks  Bookmark[]
  dismissals RecommendationDismissal[]
  progress   Progress[]
  createdAt  DateTime                  @default(now())
}

// Сессия входа. В куке — случайный токен, здесь — только sha256 от него: утечка базы не даёт чужих
// сессий, а id пользователя в куке нет вовсе, подменять нечего.
model Session {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model Bookmark {
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  titleId   String
  title     Title      @relation(fields: [titleId], references: [id], onDelete: Cascade)
  state     WatchState @default(WATCHING)
  // Своя оценка 1–10, как у Shikimori. Границы проверяет zod в server action: CHECK Prisma не умеет.
  // Оценка без списка кладёт тайтл в «Просмотрено» (решение владельца 2026-09-23).
  rating    Int?
  addedAt   DateTime   @default(now())
  // Последняя смена отметки или оценки: «последние отмеченные» в профиле.
  updatedAt DateTime   @updatedAt

  @@id([userId, titleId])
  @@index([userId, state])
  @@index([titleId])
}

// Связь «этот тайтл → тайтл Shikimori». Цель — по shikimoriId, а не по нашему id: похожий тайтл может
// ещё не быть в каталоге, и связь заработает, как только его импортируют. rank — порядок у Shikimori:
// у похожих это место в их списке (1 — самый похожий), у франшизы — порядок в ответе.
model TitleRelation {
  titleId           String
  title             Title        @relation(fields: [titleId], references: [id], onDelete: Cascade)
  targetShikimoriId Int
  kind              RelationKind
  rank              Int

  @@id([titleId, targetShikimoriId, kind])
  @@index([targetShikimoriId])
}

// «Не интересно» у рекомендации. Хранится в аккаунте: скрытый совет не возвращается ни на этом, ни на
// другом устройстве, пока его не вернут.
model RecommendationDismissal {
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  titleId   String
  title     Title    @relation(fields: [titleId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([userId, titleId])
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

// Обращение правообладателя с /dmca. Лежит в базе, а не только уходит уведомлением:
// канал уведомления может упасть, а срок ответа на жалобу от этого не сдвигается.
model DmcaRequest {
  id            String    @id @default(cuid())
  claimantName  String
  claimantEmail String
  rightsHolder  String
  targetUrl     String
  message       String    @db.Text
  // sha256 от IP с солью: лимит на поток обращений нужен, адреса заявителей в базе — нет.
  ipHash        String
  // null = уведомление не ушло: обращение принято, но мы о нём ещё не знаем.
  notifiedAt    DateTime?
  createdAt     DateTime  @default(now())

  @@index([createdAt])
  @@index([ipHash, createdAt])
}
```

## Правила работы со схемой

- `publishedAt = null` означает черновик — у тайтла и у серии. Публичные
  запросы **всегда** фильтруют `publishedAt != null` и `status != HIDDEN`.
  Хелперы `publicTitleWhere()` / `publicEpisodeWhere()` в `lib/public-where.ts`,
  публичные выборки идут только через них. Серия публична, только если публичен
  и её тайтл.
- `Title.status = HIDDEN` — рубильник по жалобе правообладателя. Скрывает тайтл
  и все его серии, ничего не удаляя. Для черновиков его не используем: снятие
  жалобы не должно случайно опубликовать недозаполненный тайтл.
- `Source.url` — адрес фрейма поставщика. Перед вставкой во фрейм он проходит
  `embedSrc()` из `lib/watch/embed.ts`: домен обязан быть в списке. Серия без
  источника — нормальное состояние, страница просмотра говорит об этом текстом.
- Серия публична независимо от наличия источника: каталог наполняется импортом
  до того, как появятся ссылки на плееры.
- Индексы `@@index([score])` и `@@index([popularityRank])` заведены, но
  сортировками пока не используются: `ORDER BY score DESC NULLS LAST` обычный
  btree не закрывает — обратный скан даёт `NULLS FIRST`. На сотнях тайтлов это
  доли миллисекунды; та же история, что с `gin_trgm_ops` у поиска.
- `score` и `popularityRank` приходят только из импорта и живут по разным
  правилам. Оценку Shikimori отдаёт полем, и у неоценённого тайтла это `0.0` —
  `mapTitle()` превращает такой ноль в `null`, иначе анонс возглавил бы список
  худших, а на карточке появился бы бейдж «0». Числового поля популярности у них
  нет вовсе, есть только сортировка `order: popularity`, поэтому ранг — это
  позиция в их ответе, и знает её лишь пакетный импорт: точечный импорт по id
  ранг не трогает, чтобы не стереть порядок, собранный пакетом. В сортировках
  каталога неизвестное значение уходит в конец, а не в начало.
- Пакетный проход сначала снимает места у всех (`resetPopularityRanks`), потом
  проставляет заново: без этого тайтл, выпавший из топа, навсегда остался бы со
  старым номером и вечно висел бы в голове сортировки. `--ongoing` мест не
  ставит вовсе — он тоже идёт `order: popularity`, но внутри одних онгоингов, и
  позиции в нём не глобальные. Каталог, налитый только им, сортировку «по
  популярности» получит пустой.
- Списком выводятся не все серии: `episodeWindow()` из `lib/episodes.ts` даёт
  окно в 100 штук — последние, а на просмотре 48 плиток вокруг текущей
  (`WATCH_EPISODE_WINDOW`) и ссылку «Все серии». У «Ван-Пис»
  1178 серий, и полный список превращает страницу тайтла в километр разметки.
  Урезанный список обязан сказать, какой диапазон показывает: молча выкинутые
  серии читаются как потеря данных. Переход по диапазонам — в роадмапе.
- `Progress` в схеме есть, но не пишется: своего плеера нет, а фрейм
  поставщика позицию просмотра нам не сообщает. Модель ждёт интеграции Kodik —
  если их плеер отдаёт события времени, прогресс вошедшего пойдёт в базу не
  чаще раза в 10 секунд и на паузе, конце серии и уходе со страницы.
- Postgres не индексирует внешние ключи сам. У каждого FK, который не стоит
  первым в составном ключе, есть свой `@@index`: иначе каскадное удаление
  тайтла или серии сканирует `Progress` целиком.
- Пользователь опознаётся по `googleId` (`sub` из id_token), не по e-mail: адрес
  у человека может смениться. Повторный вход обновляет e-mail, имя и аватар.
- `Session.tokenHash` — sha256 от токена из куки. Сам токен в базе не лежит, id
  пользователя в куке нет. Просроченная сессия равна отсутствию сессии и
  удаляется при встрече.
- `TitleRelation` пишет только импорт. Франшиза (`SEQUEL`, `PREQUEL`,
  `SIDE_STORY`, `OTHER`) приходит полем `related` того же GraphQL-запроса, что
  и метаданные; «похожие» (`SIMILAR`) — отдельным проходом
  `pnpm import:shikimori --similar`, по REST-запросу на тайтл, первые 20 с их
  порядком. Повторный импорт заменяет связи своего вида целиком, а не копит.
  Цель связи — `shikimoriId`, поэтому связь на тайтл вне каталога лежит молча и
  оживает, когда его импортируют.
- Рекомендации (`lib/recommendations/score.ts`) — чистая функция над всем
  публичным каталогом и отметками пользователя, в памяти. Кандидаты берутся
  только через `publicTitleWhere()`; отметки на скрытых и черновиках в расчёт
  не входят. Вес отметки: оценка решает, если есть (`(r − 5.5) / 4.5`), иначе
  список; брошенное — минус, а не плюс. Меньше трёх положительных отметок —
  холодный старт: популярное с высокой оценкой, и интерфейс так его и называет.
- `RecommendationDismissal` — «Не интересно». Скрыть можно только публичный
  тайтл; скрытое не советуется, пока его не вернут, и слегка опускает свои
  жанры.
- Telegram-поля (`tgId`, `username`, `firstName`) удалены 2026-09-23 миграцией
  `user_google_sessions`: вход ни разу не работал, таблица `User` была пуста.

## Поиск по названиям

Расширение `pg_trgm` объявлено в схеме (`previewFeatures = ["postgresqlExtensions"]`,
`extensions = [pgTrgm]`) и ставится миграцией, а не руками.

- Счёт считается по трём полям — `nameRu`, `name`, склейка `synonyms` — как
  максимум из `similarity(поле, запрос)` и `word_similarity(запрос, поле)`.
  Одной `similarity` мало: она делится на длину названия, и точный запрос
  «фрирен» против «Провожающая в последний путь Фрирен» даёт всего 0.21.
- Порог относительный: `GREATEST(0.2, лучший_счёт * 0.6)`. Фиксированный не
  работает на обе стороны — перестановка букв стоит двух триграмм («фиррен» →
  0.29 на реальных данных), а точный запрос даёт 1.0 и должен отсекать шум.
  Обе константы названы в `lib/queries/search.ts`.
- Подстрока `ILIKE` добавлена к счёту, но только для запросов от трёх символов:
  по «а» она совпадает почти с каждым названием и возвращает весь каталог.
  Спецсимволы процента, подчёркивания и обратного слеша экранируются.
- Условия публичности продублированы прямо в SQL, а не только во втором запросе
  через `publicTitleWhere()`: непубличный тайтл иначе занимает место в `LIMIT` и
  своим точным совпадением задирает относительный порог, выбивая живые
  результаты. Оба места закрыты тестами в `tests/db/search.test.ts`.
- Каталог ищет тем же запросом: `?q=` в `/catalog` отбирает идентификаторы через
  `rankTitleIds()` и кладёт их в `id IN (...)` рядом с жанром, годом и типом.
  Поиск сужает набор, а не заменяет выдачу, поэтому фильтры, сортировка и
  страницы работают поверх него как обычно. Предел отбора там выше, чем на
  `/search` (`CATALOG_MATCH_LIMIT`): там это готовая выдача, а здесь поверх
  ещё лягут фильтры, и короткий список опустел бы от первого же жанра.
  Порядок задаёт выбранная сортировка, а не счёт совпадения: относительный
  порог и так отсекает слабые совпадения, и выживает только близкое.
- GIN-индексы `gin_trgm_ops` на `nameRu` и `name` созданы, но планом пока не
  используются: счёт считается выражением, а не оператором сравнения по
  триграммам. На нынешнем объёме это доли миллисекунды; переход на оператор
  с порогом — в открытых вопросах роадмапа.

## Prisma 7: как устроено подключение

Версия 7.10 (почему не 8 — в `docs/02`, «Версии»).

- **Три URL.** `DATABASE_URL` — через пулер, им пользуется приложение
  (`lib/db.ts`, driver adapter `@prisma/adapter-pg`). `DIRECT_URL` — прямое
  соединение для CLI: миграции через pgbouncer не работают.
  `SHADOW_DATABASE_URL` — пустая база, в которой Prisma примеряет миграции.
  Локально первые два указывают на одну базу.
- **Превью Vercel — своя ветка базы.** Проект Neon подключён к Vercel их
  интеграцией (2026-09-24): на каждое превью Neon создаёт ветку базы от `main`
  (копия боевых данных, copy-on-write) и отдаёт её адреса — `DATABASE_URL` и
  прямой `DATABASE_URL_UNPOOLED`. На превью `prisma.config.ts` берёт только
  `DATABASE_URL_UNPOOLED`, а `scripts/vercel-build.sh` мигрирует превью лишь
  тогда, когда хост этой ветки отличается от боевого. Нет ветки — миграции
  пропущены, как было раньше.
- **`prisma.config.ts`** держит путь к схеме, миграциям, команду seed и оба
  CLI-URL. `.env` Prisma сама не читает: конфиг подгружает `.env.local`.
- **Клиент генерируется** в `lib/generated/prisma` (в git не попадает) на
  `postinstall`. Импорт в приложении — только `prisma` из `lib/db.ts`: модуль
  помечен `server-only`, и импорт из клиентского компонента роняет сборку.
- **`migrate dev` клиент не пересобирает.** В Prisma 7 после новой миграции нужен
  `pnpm exec prisma generate` (на Vercel это делает `postinstall`). Иначе клиент не знает
  новое поле, и запись падает в рантайме с «Unknown argument». В импорте объект полей
  помечен `satisfies Prisma.TitleUpdateInput`, чтобы такое ловил уже `tsc`.
- **Миграции.** Обычная — `pnpm db:migrate`. Миграцию с потерей данных
  `migrate dev` не сделает: он требует интерактивного подтверждения, которого в
  сессии агента нет. Тогда SQL генерируется Prisma же:
  `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`
  (нужен `SHADOW_DATABASE_URL`), файл кладётся в новую папку миграции и
  применяется `pnpm db:deploy`. Руками SQL не пишется ни в каком случае.
- **Seed** (`prisma/seed.ts`) идемпотентен и пишет только в локальную базу.
  Для удалённой нужен явный `SEED_ALLOW_REMOTE=1`.
- **Пул в serverless.** Сейчас `PrismaPg` сам создаёт `pg.Pool` с настройками по
  умолчанию (до 10 соединений). Vercel замораживает инстанс вместе с открытыми
  соединениями, и после разморозки первый запрос может попасть в оборванный
  сокет. До прода: явный `pg.Pool` с маленьким `max` и коротким
  `idleTimeoutMillis`, плюс `attachDatabasePool` из `@vercel/functions`.
- У `pg` по умолчанию нет таймаута соединения, поэтому в `lib/db.ts` заданы
  `connectionTimeoutMillis` (5 с) и `query_timeout` (15 с).
- `lib/db.ts` проверяет `DATABASE_URL` при импорте, поэтому `next build`
  страниц с запросами требует этот env и в CI.
- Локально стоит Postgres 14 из Homebrew, на проде будет новее. Схема не
  использует ничего версии-специфичного; расширения (`pg_trgm`) проверять на
  обеих.
