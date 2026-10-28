#!/usr/bin/env bash
# Runs on the server after CI has synced the code: rebuild, verify, and roll back if the new version is unhealthy.
# Usage: deploy/remote_deploy.sh [GIT_SHA]
set -euo pipefail
cd "$(dirname "$0")/.."

SHA="${1:-unknown}"
PORT=$(grep -E '^CRM_PORT=' .env 2>/dev/null | cut -d= -f2 || true)
BASE="http://localhost:${PORT:-8080}"
SERVICES="backend frontend"

[ -f .env ] || { echo "Missing .env (JWT_SECRET_KEY, CRM_PORT) on the server" >&2; exit 1; }
[ -f secrets/credentials.json ] || { echo "Missing secrets/credentials.json on the server" >&2; exit 1; }

echo "==> Keeping current images for rollback"
for svc in $SERVICES; do
  if docker image inspect "srinivas-crm-$svc:latest" >/dev/null 2>&1; then
    docker tag "srinivas-crm-$svc:latest" "srinivas-crm-$svc:rollback"
  fi
done

echo "==> Building and starting $SHA"
docker compose up -d --build --remove-orphans

echo "==> Verifying"
if bash deploy/smoke_test.sh "$BASE"; then
  echo "$SHA" > .deployed-sha
  docker image prune -f >/dev/null
  echo "==> Deployed $SHA"
  exit 0
fi

echo "==> New version is unhealthy; rolling back" >&2
docker compose logs --tail 60 >&2 || true
for svc in $SERVICES; do
  docker tag "srinivas-crm-$svc:rollback" "srinivas-crm-$svc:latest" 2>/dev/null || true
done
docker compose up -d --no-build --force-recreate
if bash deploy/smoke_test.sh "$BASE"; then
  echo "==> Rolled back to $(cat .deployed-sha 2>/dev/null || echo 'previous version')" >&2
else
  echo "==> ROLLBACK ALSO UNHEALTHY - manual attention needed" >&2
fi
exit 1
