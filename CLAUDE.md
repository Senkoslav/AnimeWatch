# AnimeWatch — каталог аниме с плеером

Каталог, поиск и просмотр аниме. Видео мы не храним и не раздаём: метаданные
свои, воспроизведение — во фрейме стороннего поставщика (Kodik). Аудитория —
русскоязычные зрители, 70%+ трафика мобильный.

Живой сайт: https://animewatch-gamma.vercel.app. Заявка на доступ к базе Kodik
отправлена 2026-09-24 (`docs/05-kodik.md`). Ближайшая цель — чтобы после выдачи
токена серии заиграли одной переменной `KODIK_API_TOKEN` (фаза D роадмапа), а
до тех пор сайт выглядел и работал как готовый продукт.

## Обязательное чтение перед задачей

@docs/01-product-brief.md
@docs/02-architecture.md
@docs/03-data-model.md
@docs/04-design-system.md
@docs/06-roadmap.md

## Правила работы

- Перед реализацией любой задачи из роадмапа — войди в plan mode, покажи план,
  дождись подтверждения. Не начинай писать код по задаче, которой нет в
  `docs/06-roadmap.md`, — сначала добавь её туда.
- Одна задача = одна ветка = один PR. Ветка: `feat/<scope>-<slug>`.
- Коммиты на английском, Conventional Commits: `feat(catalog): add year filter`.
- Не помечай задачу выполненной, пока не прошли `pnpm verify` и e2e по этой фиче.
- Не трогай `prisma/migrations/*` руками. Схему меняешь — генерируешь миграцию
  (`pnpm db:migrate`; для миграции с потерей данных — `prisma migrate diff`,
  см. `docs/03`).
- Не добавляй зависимость без записи причины в PR-описание. Для любой новой
  библиотеки сначала проверь, решается ли задача тем, что уже в проекте.

## Команды

Node 24 из `.nvmrc` (`nvm use`): на 25.x Vitest не поддерживается.

```bash
pnpm dev              # next dev (Turbopack по умолчанию)
pnpm verify           # typecheck + lint + test:unit + test:db  ← гоняй перед коммитом
pnpm build            # next build, проверяет типы
pnpm lint             # eslint, предупреждения тоже роняют
pnpm format           # prettier --write .
pnpm test:unit        # vitest, чистая логика
pnpm test:db          # vitest на базе animewatch_test (нужен локальный Postgres)
pnpm test:e2e         # playwright: chromium-desktop и mobile-chrome
pnpm db:migrate       # prisma migrate dev, только локально
pnpm db:seed          # тестовые данные, только в локальную базу
pnpm db:deploy        # prisma migrate deploy: прод и CI
pnpm db:studio        # prisma studio
```

Не выводи содержимое `.env`, `.env.local` и значения токенов в ответах. Не
запускай `vercel env pull` в `.env.local`: он перезапишет локальные адреса базы
облачными. Имена переменных смотри через `vercel env ls` — значения там не видны.

## Стек и границы

- Next.js (App Router) + TypeScript strict. React Server Components по умолчанию,
  `"use client"` — только там, где нужен стейт или обработчики.
- Данные в серверных компонентах тянем напрямую через Prisma. Route handlers
  (`app/api/*`) — только для того, что реально вызывается снаружи.
- Валидация всех внешних входов — zod, на границе. Внутри типы уже доверенные.
- Мутации — server actions. Публичная форма (`/dmca`) роль не проверяет, но
  проходит zod, ловушку для ботов и лимит по IP; всё остальное проверяет сессию
  и роль первым делом (`getCurrentUser()` из `lib/auth/session.ts`). Публичное
  чтение через action (живой поиск `quickSearch`) — тоже zod и лимит по IP.
- Лимиты запросов — `lib/rate-limit.ts` на Redis (`REDIS_URL`). Redis недоступен —
  лимит пропускает запрос и пишет в лог, а не роняет страницу.
- Вход — Google OAuth своими руками (`lib/auth/`, `docs/02`). Сессию читают только
  server actions и динамические страницы: чтение куки в лэйауте или на ISR-странице
  сделало бы её динамической. Шапка и кнопки знают о входе по показной куке
  `aw_user` в браузере; прав она не даёт.
- Стили — Tailwind с токенами из дизайн-дока. Никаких инлайновых hex-цветов.

## Чего в этом проекте не делаем

- Не хостим, не проксируем и не скачиваем видеофайлы. Плеер — фрейм поставщика,
  и адрес фрейма проверяется по списку доменов (`lib/watch/embed.ts`).
- Не пишем свой плеер и свой транскодер. Эта попытка уже была и откатана:
  поставщик отдаёт готовый плеер.
- Никаких localStorage/sessionStorage для того, что должно переживать смену
  устройства: прогресс просмотра авторизованного пользователя — в БД.
- Не кладём секреты в клиентский бандл. Всё, что не `NEXT_PUBLIC_*`, читается
  только в серверном коде; проверь это перед коммитом любого нового env.
- Не используем `any` и `@ts-expect-error` без комментария с причиной.

## Контент и право

Сайт даёт доступ к чужому контенту через сторонний плеер. Поэтому в коде всегда
должны быть живыми: страница `/dmca` с формой обращения, дисклеймер и ссылки в
футере, и возможность за один запрос скрыть тайтл целиком
(`Title.status = HIDDEN`). Не удаляй эти места «за ненадобностью».

## Стиль ответов

Отвечай по делу, без пересказа того, что уже сделано. Если нашёл проблему в
моей постановке задачи — скажи до того, как начнёшь писать код.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
