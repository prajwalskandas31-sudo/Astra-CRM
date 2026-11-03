#!/bin/sh
# Backend container entrypoint: prepare the database once, then start the API workers.
set -e
python -m backend.db_init
# Each worker is a separate process with its own database pool; 6 suits an 8 vCPU server that also runs Postgres
# A worker busy with a large download must not be mistaken for a hung one and killed mid-request
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-6}" --timeout-keep-alive 30      --timeout-worker-healthcheck 60
