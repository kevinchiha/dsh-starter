#!/usr/bin/env bash
# Fail if anything personal or secret is about to be committed.
# Allowed: the two docs folders (they name the source machine on purpose),
# the README's author line, this repo's own GitHub URL, and this script
# itself, which has to spell the words out in order to search for them.
set -euo pipefail
cd "$(dirname "$0")/.."

pattern='kevin|omarchyos|persovps|Kimipaseobot|loopgraph|/home/kevin|sk-ant-|TELEGRAM_BOT_TOKEN=[0-9]'
hits=$(grep -rniE "$pattern" . \
  --exclude-dir=.git --exclude-dir=docs --exclude-dir=node_modules --exclude-dir=.superpowers \
  | grep -vE '^\./README\.md:[0-9]+:.*[Kk]evin Chiha' \
  | grep -vE 'github\.com/kevinchiha/dsh-starter' \
  | grep -vE '^\./scripts/check-leaks\.sh:[0-9]+:' || true)

if [[ -n "$hits" ]]; then
  echo "check-leaks: personal or secret strings found:" >&2
  echo "$hits" >&2
  exit 1
fi
echo "check-leaks: clean"
