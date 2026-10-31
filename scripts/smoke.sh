#!/usr/bin/env bash
# End-to-end smoke test.
# Usage:
#   ./scripts/smoke.sh [BACKEND_URL] [FRONTEND_URL] [EXPECTED_VERSION]
set -euo pipefail

BACKEND="${1:-http://localhost:8000}"
BACKEND="${BACKEND%/}"
FRONTEND="${2:-http://localhost:3000}"
FRONTEND="${FRONTEND%/}"
EXPECTED_VERSION="${3:-}"

echo "-> checking health at $BACKEND/api/health"
HEALTH_RES=$(curl -sSf "$BACKEND/api/health")
echo "$HEALTH_RES" | grep -q '"status":"ok"' || {
  echo "ERROR: Health status is not ok: $HEALTH_RES" >&2
  exit 1
}
echo "$HEALTH_RES" | grep -q '"db":"ok"' || {
  echo "ERROR: Database status is not ok: $HEALTH_RES" >&2
  exit 1
}

if [ -n "$EXPECTED_VERSION" ]; then
  echo "-> verifying version: $EXPECTED_VERSION"
  echo "$HEALTH_RES" | grep -q "\"version\":\"$EXPECTED_VERSION\"" || {
    echo "ERROR: Expected version $EXPECTED_VERSION not found in $HEALTH_RES" >&2
    exit 1
  }
fi

echo "-> checking frontend at $FRONTEND/"
curl -sSf "$FRONTEND/" > /dev/null || {
  echo "ERROR: Frontend is not answering at $FRONTEND/" >&2
  exit 1
}

echo "-> checking login at $BACKEND/api/auth/login"
LOGIN_RES=$(curl -sSf -X POST "$BACKEND/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@phoenix.dev","password":"phoenix123"}')

echo "$LOGIN_RES" | grep -q '"access_token"' || {
  echo "ERROR: Login response missing access_token: $LOGIN_RES" >&2
  exit 1
}

echo "SMOKE OK"
