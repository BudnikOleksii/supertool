#!/bin/bash
# PostToolUse hook: format files edited by the agent (carried pattern from the
# backend example's .rulesync format hook, adapted to oxfmt/stylelint).
# Reads the hook payload from stdin and formats the touched file. Always exits 0.

set -u

payload="$(cat)"
file_path="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"

if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

# Only format files inside this repository
project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
case "$file_path" in
  "$project_dir"/*) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  */example/* | */node_modules/* | */_bmad/* | */_bmad-output/*)
    exit 0
    ;;
  *.ts | *.tsx | *.cts | *.mts | *.js | *.jsx | *.cjs | *.mjs | *.json | *.md)
    cd "${CLAUDE_PROJECT_DIR:-.}" && pnpm exec oxfmt --write "$file_path" >/dev/null 2>&1
    ;;
  *.scss | *.css)
    cd "${CLAUDE_PROJECT_DIR:-.}" && pnpm exec stylelint --fix "$file_path" >/dev/null 2>&1
    ;;
esac

exit 0
