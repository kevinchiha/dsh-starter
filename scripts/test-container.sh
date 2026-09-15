#!/usr/bin/env bash
# Run the install on a clean Debian image. This proves the package names in the
# guide are right and that nothing in the starter depends on the author's
# machine. Systemd and Tailscale are not covered here; check those by hand.
#
# Networking: the proxy on the host listens on 127.0.0.1 only, so the container
# runs with --network host and shares the host's loopback. That means the
# settings.yaml URLs (127.0.0.1:8317) work unchanged, and the test web server
# must use a port nothing on the host is already using.
#
# Nothing on the host is touched: the container is --rm, the repo is mounted
# read-only, and the proxy key is passed in as an environment variable only.
set -euo pipefail
cd "$(dirname "$0")/.."

# Set BUILD_ESSENTIAL=1 to add a C/C++ compiler to the image. Leave it unset to
# find out whether the install needs one.
APT_PACKAGES="curl git openssl python3 python3-yaml python3-venv ffmpeg"
if [[ "${BUILD_ESSENTIAL:-0}" == "1" ]]; then
  APT_PACKAGES="$APT_PACKAGES build-essential"
fi

KEY="$("$HOME/.local/bin/cliproxyapi-key")"
docker run --rm -i --network host \
  -v "$PWD:/starter:ro" -e KEY="$KEY" -e APT_PACKAGES="$APT_PACKAGES" \
  debian:13 bash -s <<'EOF'
set -euo pipefail
echo "apt packages: $APT_PACKAGES"
apt-get update -qq
apt-get install -y -qq $APT_PACKAGES >/dev/null
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
apt-get install -y -qq nodejs >/dev/null

# The guide installs pnpm and dsh with one npm line; the test does the same.
npm i -g pnpm@11.7.0 @deepseek-ai/dsh@0.1.5-rc.1 >/dev/null
echo "node: $(node --version)  pnpm: $(pnpm --version)  dsh: $(dsh --version)"

export DSH_HOME=/root/.dsh
mkdir -p "$DSH_HOME" && cp -r /starter/dsh/. "$DSH_HOME/"
printf 'version: 1\nrefs:\n  CLIPROXYAPI_KEY: %s\n' "$KEY" > "$DSH_HOME/.credentials.yaml"
chmod 600 "$DSH_HOME/.credentials.yaml"

# The profile sets nodeLinker: hoisted, so node_modules is flat and there is no
# per-package directory to count. Use pnpm's own "Packages: +N" line instead.
(cd "$DSH_HOME/profiles/web" && pnpm install --frozen-lockfile 2>&1 | tee /tmp/pnpm.log)
grep -E '^(Packages: \+|Lockfile is up to date)' /tmp/pnpm.log || true

dsh --profile web --dump-config >/dev/null && echo "dump-config: ok"

mkdir -p /root/.local/bin && cp /starter/bin/* /root/.local/bin/
export PATH=/root/.local/bin:$PATH
dsh-model --help >/dev/null && echo "dsh-model: ok"

mkdir -p /root/.agents && cp -r /starter/skills /root/.agents/skills
python3 -m venv /root/.agents/skills/youtube-fetcher/.venv
/root/.agents/skills/youtube-fetcher/.venv/bin/pip install -q \
  -r /root/.agents/skills/youtube-fetcher/requirements.txt \
  && echo "youtube-fetcher venv: ok"

dsh web --no-open --port 3098 > /tmp/web.log 2>&1 &
sleep 15
cat /tmp/web.log
curl -s -o /dev/null -w 'dsh web: http %{http_code}\n' http://127.0.0.1:3098/
EOF
