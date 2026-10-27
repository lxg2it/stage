#!/usr/bin/env bash
# Deploy Stage to sim.lxg2it.com.
#
# The site is a vite build served as a static directory by nginx on the AU box
# (/etc/nginx/conf.d/sim.conf, root /var/www/sim). There is no container and no
# server process, so a deploy is: build, rsync the tree, done. nginx reads the
# files per request, so no reload is needed for content changes.
#
# --delete removes bundles whose hashes are no longer referenced. index.html is
# served with Cache-Control: no-cache and /assets/* is immutable, which is why
# the hashed filenames can be replaced wholesale.
set -euo pipefail

HOST="${STAGE_HOST:-ec2-user@13.54.219.192}"
DEST="${STAGE_DEST:-/var/www/sim}"
URL="${STAGE_URL:-https://sim.lxg2it.com/}"

cd "$(dirname "$0")/.."

npm run build
rsync -a --delete dist/ "$HOST:$DEST/"

# Verify against the live URL rather than the staged tree: a deploy that copied
# files but was never served is the failure this check exists to catch.
echo "--- verifying $URL"
curl -sS -o /tmp/stage-index.html -w 'index %{http_code} %{size_download}B\n' "$URL"

status=0
while read -r asset; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "https://sim.lxg2it.com${asset}")
  printf '%-32s %s\n' "$asset" "$code"
  [ "$code" = "200" ] || status=1
done < <(grep -o '/assets/[A-Za-z0-9._-]*' /tmp/stage-index.html | sort -u)

exit "$status"
