#!/bin/bash
# PostToolUse: prüft die gerade bearbeitete Datei mit ESLint und meldet Fehler an Claude zurück.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts|*.tsx|*.mts|*.mjs|*.js) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -x node_modules/.bin/eslint ] || exit 0

if ! out=$(node_modules/.bin/eslint --quiet --no-warn-ignored "$file" 2>&1); then
  echo "ESLint-Fehler in $file:" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
