#!/usr/bin/env bash
# Restore the CRM database from a backup file in ./backups (replaces ALL current data).
# Usage (on the server, in ~/srinivas-crm): deploy/restore_backup.sh backups/crm-YYYYMMDD-HHMMSS.dump
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?usage: deploy/restore_backup.sh backups/crm-....dump}"
[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }

read -r -p "This replaces every record in the CRM with the contents of $FILE. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

docker compose stop backend
# --clean drops the current tables first; the backup holds the full schema and data
docker compose exec -T db pg_restore --clean --if-exists -U crm -d crm < "$FILE"
docker compose start backend
echo "Restored $FILE"
