#!/usr/bin/env bash
# Install the starter's dsh files into a throwaway home and boot it on port 3099.
# Never touches ~/.dsh or port 3080.
set -euo pipefail
cd "$(dirname "$0")/.."
export DSH_HOME=/tmp/dsh-starter-test
rm -rf "$DSH_HOME"; mkdir -p "$DSH_HOME"
cp -r dsh/. "$DSH_HOME/"
# The live proxy key, read at run time; never written into the repo.
printf 'version: 1\nrefs:\n  CLIPROXYAPI_KEY: %s\n' "$("$HOME/.local/bin/cliproxyapi-key")" > "$DSH_HOME/.credentials.yaml"
chmod 600 "$DSH_HOME/.credentials.yaml"
(cd "$DSH_HOME/profiles/web" && pnpm install)
dsh --profile web --dump-config > "$DSH_HOME/composed.yml"
echo "composed rows: $(grep -c '^- id:' "$DSH_HOME/composed.yml" || true)"
echo "starting dsh web on 3099; kill with: kill \$(cat $DSH_HOME/web.pid)"
nohup dsh web --no-open --port 3099 > "$DSH_HOME/web.log" 2>&1 &
echo $! > "$DSH_HOME/web.pid"
sleep 8
curl -s -o /dev/null -w 'http %{http_code}\n' http://127.0.0.1:3099/
