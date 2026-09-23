#!/usr/bin/env sh
# Сборка на Vercel. Миграции применяются здесь, а не руками: собранный деплой обязан означать
# «работает», а не «скомпилировалось». Без этого шага код, читающий новую колонку, уезжает в прод
# раньше самой колонки, и падает только рантайм — сборка при этом зелёная.
#
# Превью мигрирует только свою ветку базы. Её создаёт интеграция Neon ↔ Vercel и отдаёт прямой
# адрес в DATABASE_URL_UNPOOLED; prisma.config.ts на превью берёт только его. Если ветки нет
# (интеграция не отработала) или её адрес указывает на ту же базу, что и прод, миграции
# пропускаются: боевая база не должна получить миграцию с недоделанной ветки.
set -e

# Хост из postgres-адреса: postgresql://user:pass@HOST/db?… → HOST.
db_host() {
  printf '%s' "$1" | sed -E 's#^[a-z]+://([^@/]*@)?([^/:?]+).*#\2#'
}

# Обязательный секрет прода. Без соли lib/dmca/throttle.ts отказывается хешировать IP заявителя, и
# форма /dmca падает на отправке — страница, которую сайт обязан держать живой. Так было до
# 2026-09-24: сборка зеленела, а ломалась только форма. Теперь без соли не собирается сам прод.
if [ "$VERCEL_ENV" = "production" ] && [ -z "$DMCA_IP_SALT" ]; then
  echo "DMCA_IP_SALT не задан в Production: форма /dmca не сможет принять обращение. Задайте его в Vercel → Environment Variables." >&2
  exit 1
fi

if [ "$VERCEL_ENV" = "production" ]; then
  echo "Продакшен: применяю миграции"
  pnpm exec prisma migrate deploy
elif [ "$VERCEL_ENV" = "preview" ] && [ -n "$DATABASE_URL_UNPOOLED" ] \
  && [ "$(db_host "$DATABASE_URL_UNPOOLED")" != "$(db_host "$DIRECT_URL")" ]; then
  echo "Превью: своя ветка базы Neon ($(db_host "$DATABASE_URL_UNPOOLED")), применяю миграции в неё"
  pnpm exec prisma migrate deploy
else
  echo "Окружение $VERCEL_ENV: своей ветки базы нет, миграции пропущены"
fi

pnpm exec next build
