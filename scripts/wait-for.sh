#!/usr/bin/env bash
# Usage: ./scripts/wait-for.sh <URL> [TIMEOUT_SECONDS]
set -euo pipefail

URL="${1:?URL is required}"
TIMEOUT="${2:-60}"

echo "Waiting up to ${TIMEOUT}s for $URL to respond..."
START=$(date +%s)

while true; do
  if curl -sSf "$URL" > /dev/null 2>&1; then
    echo "$URL is ready!"
    exit 0
  fi

  NOW=$(date +%s)
  ELAPSED=$((NOW - START))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "Timeout after ${TIMEOUT}s waiting for $URL" >&2
    exit 1
  fi

  sleep 1
done

