# BebraDub — сайт студии аниме-озвучки

Каталог + плеер собственной озвучки. Аудитория — рускоязычные зрители аниме,
70%+ трафика мобильный. Ориентир по плотности интерфейса — animelib, но
визуальный язык свой (см. дизайн-док, повторять чужой стиль не нужно).

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
- Коммиты на английском, Conventional Commits: `feat(player): add quality menu`.
- Не помечай задачу выполненной, пока не прошли `pnpm verify` и e2e по этой фиче.
- Не трогай `prisma/migrations/*` руками. Схему меняешь — генерируешь миграцию.
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
pnpm test:db          # vitest на базе bebradub_test (нужен локальный Postgres)
pnpm test:e2e         # playwright: chromium-desktop и mobile-chrome
pnpm db:migrate       # prisma migrate dev, только локально
pnpm db:seed          # тестовые данные, только в локальную базу
pnpm db:deploy        # prisma migrate deploy: прод и CI
pnpm db:studio        # prisma studio
pnpm worker:dev       # воркер импорта видео (отдельный процесс)

pnpm typecheck        # tsc по корню и воркеру
pnpm video:probe      # ffprobe и тест апскейла мастеров → markdown для docs/05
pnpm data:inventory   # выгрузка Telegram Desktop → черновик data/inventory.csv
pnpm bunny:check      # защита библиотеки Bunny: подписанный URL играет, без подписи 403
pnpm tg:login         # вход аккаунтом-воркером → TG_SESSION в worker/.env
pnpm tg:whoami        # ник, Premium и роль воркера в архивном канале
```

`pnpm tg:login` запускает только человек в своём терминале: скрипт интерактивный,
а сессия даёт полный доступ к аккаунту. Не запускай его сам и не выводи
содержимое `.env`, `.env.local`, `worker/.env`.

## Стек и границы

- Next.js (App Router) + TypeScript strict. React Server Components по умолчанию,
  `"use client"` — только там, где нужен стейт, плеер или обработчики.
- Данные в серверных компонентах тянем напрямую через Prisma. Route handlers
  (`app/api/*`) — только для того, что реально вызывается снаружи: вебхуки,
  плейлисты плеера, эндпоинты воркера, аплоады.
- Валидация всех внешних входов — zod, на границе. Внутри типы уже доверенные.
- Мутации — server actions, каждая проверяет сессию и роль первым делом.
- Стили — Tailwind с токенами из дизайн-дока. Никаких инлайновых hex-цветов.

## Чего в этом проекте не делаем

- Никаких localStorage/sessionStorage для того, что должно переживать смену
  устройства: прогресс просмотра авторизованного пользователя — в БД.
- Не хостим и не проксируем видеофайлы через Next.js. Раздача только с CDN.
- Не кладём секреты в клиентский бандл. Всё, что не `NEXT_PUBLIC_*`, читается
  только в серверном коде; проверь это перед коммитом любого нового env.
- Не пишем свой транскодер, пока это явно не решено в роадмапе.
- Не используем `any` и `@ts-expect-error` без комментария с причиной.

## Контент и право

Сайт раздаёт любительскую озвучку поверх чужого контента. Поэтому в коде всегда
должны быть живыми: страница `/dmca` с формой обращения, дисклеймер в футере,
и возможность за один запрос скрыть тайтл целиком (`Title.status = HIDDEN`).
Не удаляй эти места «за ненадобностью».

## Стиль ответов

Отвечай по делу, без пересказа того, что уже сделано. Если нашёл проблему в
моей постановке задачи — скажи до того, как начнёшь писать код.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
