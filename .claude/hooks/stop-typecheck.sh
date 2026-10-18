#!/bin/bash
# Stop: läuft der Typecheck nicht durch, darf Claude die Aufgabe nicht als fertig melden.
set -uo pipefail

input=$(cat)
# Endlosschleife vermeiden: beim zweiten Stop-Versuch nicht erneut blockieren.
[ "$(echo "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -x node_modules/.bin/tsc ] || exit 0
# Nur prüfen, wenn TypeScript-Dateien geändert wurden.
git status --porcelain -- '*.ts' '*.tsx' '*.mts' | grep -q . || exit 0

if ! out=$(node_modules/.bin/tsc --noEmit 2>&1); then
  echo "Typecheck schlägt fehl – bitte beheben, bevor die Aufgabe als fertig gilt:" >&2
  echo "$out" | head -40 >&2
  exit 2
fi
exit 0
