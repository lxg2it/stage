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
HOSTNAME_ONLY="${URL#*://}"; HOSTNAME_ONLY="${HOSTNAME_ONLY%%/*}"

cd "$(dirname "$0")/.."

npm run build
rsync -a --delete dist/ "$HOST:$DEST/"

# Verify against the live URL rather than the staged tree: a deploy that copied
# files but was never served is the failure this check exists to catch.
#
# Resolve through 1.1.1.1 and pin the answer, because the local resolver is not a
# safe oracle: a home router caches the NXDOMAIN it got before the record was
# created, so the first deploy after a DNS change would "fail" verification with
# the site perfectly live. dig is the dependency; without it, fall back to the
# system resolver rather than refusing to verify at all.
echo "--- verifying $URL"
RESOLVE=()
if command -v dig >/dev/null; then
  ip=$(dig +short +time=3 +tries=1 "$HOSTNAME_ONLY" @1.1.1.1 | grep -Eo '^[0-9.]+$' | head -1 || true)
  if [ -n "$ip" ]; then
    RESOLVE=(--resolve "${HOSTNAME_ONLY}:443:${ip}")
    echo "    $HOSTNAME_ONLY -> $ip (via 1.1.1.1)"
  else
    echo "    WARNING: 1.1.1.1 returned no A record for $HOSTNAME_ONLY; using the system resolver"
  fi
fi

curl -sS "${RESOLVE[@]}" -o /tmp/stage-index.html -w 'index %{http_code} %{size_download}B\n' "$URL"

status=0
while read -r asset; do
  code=$(curl -sS "${RESOLVE[@]}" -o /dev/null -w '%{http_code}' "https://${HOSTNAME_ONLY}${asset}")
  printf '%-32s %s\n' "$asset" "$code"
  [ "$code" = "200" ] || status=1
done < <(grep -o '/assets/[A-Za-z0-9._-]*' /tmp/stage-index.html | sort -u)

exit "$status"
