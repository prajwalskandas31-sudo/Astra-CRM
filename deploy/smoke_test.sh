#!/usr/bin/env bash
# Black-box checks against a running CRM stack.
# Usage: deploy/smoke_test.sh BASE_URL [EMAIL PASSWORD]
# With EMAIL/PASSWORD it also signs in and confirms the session works end to end.
set -uo pipefail

BASE="${1%/}"
EMAIL="${2:-}"
PASSWORD="${3:-}"

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

for i in $(seq 1 45); do
  curl -fsS "$BASE/api/health" >/dev/null 2>&1 && break
  [ "$i" -eq 45 ] && fail "backend health check never came up at $BASE/api/health"
  sleep 2
done
echo "ok   backend healthy"

curl -fsS "$BASE/" | grep -q 'id="root"' || fail "frontend index page not served"
echo "ok   frontend served"

case "$(code "$BASE/api/users")" in 401|403) echo "ok   API rejects anonymous requests" ;; *) fail "API answered an anonymous request" ;; esac

curl -s "$BASE/openapi.json" "$BASE/api/openapi.json" | grep -q '"openapi"' && fail "API schema is publicly exposed"
echo "ok   API schema not exposed"

status=$(code -H 'Content-Type: application/json' -d '{"email":"smoke-test@invalid.example","password":"not-a-password"}' "$BASE/api/auth/login")
[ "$status" = "401" ] || fail "invalid login returned $status (expected 401)"
echo "ok   invalid login rejected"

if [ -n "$EMAIL" ]; then
  body=$(curl -s -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE/api/auth/login")
  token=$(printf '%s' "$body" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
  [ -n "$token" ] || fail "valid login failed"
  [ "$(code -H "Authorization: Bearer $token" "$BASE/api/auth/me")" = "200" ] || fail "session token rejected"
  curl -s -H "Authorization: Bearer $token" "$BASE/api/users" | grep -q 'passwordHash' && fail "password hashes exposed"
  echo "ok   real login, session and data scrubbing"
fi

echo "Smoke test passed for $BASE"
