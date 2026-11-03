#!/bin/sh
# Runs in the "backup" container: a compressed pg_dump every night at BACKUP_HOUR (server time, default 02),
# kept for BACKUP_KEEP_DAYS (default 14) in ./backups on the host.
# Restore one with deploy/restore_backup.sh.
set -eu
DIR=/backups
mkdir -p "$DIR"

dump() {
  file="$DIR/crm-$(date +%Y%m%d-%H%M%S).dump"
  if pg_dump -Fc -f "$file.partial"; then
    mv "$file.partial" "$file"
    echo "backup written: $file ($(du -h "$file" | cut -f1))"
    find "$DIR" -name 'crm-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
  else
    rm -f "$file.partial"
    echo "BACKUP FAILED at $(date)" >&2
  fi
}

# One backup at start-up (so a fresh deploy is covered), then nightly
until pg_isready -q; do sleep 2; done
dump
while true; do
  sleep 3600
  [ "$(date +%H)" = "${BACKUP_HOUR:-02}" ] && dump
done
