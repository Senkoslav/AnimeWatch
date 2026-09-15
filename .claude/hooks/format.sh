#!/usr/bin/env bash
# PostToolUse(Edit|Write): форматирует изменённый файл prettier'ом проекта.
# Путь приходит JSON-ом в stdin. Пока prettier не установлен (фаза 1), молча выходит.
# Нужен jq.
set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
file=$(jq -r '.tool_input.file_path // empty')

[ -n "$file" ] || exit 0

# Файлы вне проекта (например, план в ~/.claude) не трогаем.
case "$file" in
  "$project_dir"/*) ;;
  *) exit 0 ;;
esac

case "$file" in
  *.ts | *.tsx | *.css | *.json | *.md) ;;
  *) exit 0 ;;
esac

prettier="$project_dir/node_modules/.bin/prettier"
[ -x "$prettier" ] || exit 0

# Файл с синтаксической ошибкой prettier не разберёт — это поймает typecheck, правку не блокируем.
"$prettier" --write --log-level warn "$file" >&2 || true
