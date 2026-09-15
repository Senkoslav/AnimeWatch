#!/usr/bin/env bash
# Stop: гоняет pnpm typecheck, если в рабочем дереве есть изменённые .ts/.tsx.
# Ошибки уходят в stderr с exit 2: Claude их видит и продолжает работу, чтобы починить.
# Если Claude уже продолжал из-за этого хука (stop_hook_active), второй раз не блокируем,
# а показываем предупреждение пользователю — иначе можно зациклиться.
# Нужен jq.
set -uo pipefail

input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0

[ -f package.json ] || exit 0
jq -e '.scripts.typecheck' package.json >/dev/null 2>&1 || exit 0
git status --porcelain --untracked-files=all -- '*.ts' '*.tsx' 2>/dev/null | grep -q . || exit 0

if output=$(pnpm --silent typecheck 2>&1); then
  exit 0
fi

tail_output=$(printf '%s\n' "$output" | tail -n 30)

if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  jq -n --arg out "$tail_output" \
    '{systemMessage: ("typecheck всё ещё падает, повторно не блокирую:\n" + $out)}'
  exit 0
fi

printf 'pnpm typecheck упал, почини ошибки типов:\n%s\n' "$tail_output" >&2
exit 2
