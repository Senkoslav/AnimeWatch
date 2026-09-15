#!/usr/bin/env bash
# PostToolUse(Edit|Write): после правки prisma/schema.prisma напоминает Claude про миграцию и доку.
# Обычный stdout при exit 0 модель не видит, поэтому ответ идёт через additionalContext.
# Нужен jq.
set -euo pipefail

file=$(jq -r '.tool_input.file_path // empty')

case "$file" in
  */prisma/schema.prisma)
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "Схема изменена: сгенерируй миграцию (pnpm db:migrate) и обнови docs/03-data-model.md."
      }
    }'
    ;;
esac
