import importlib
import json
import os
import secrets
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="module")
def crm(tmp_path_factory):
    """A fresh backend (empty database, seed data, random credentials, new JWT secret) for each test module."""
    import backend.database as database
    importlib.reload(database)
    # SQLite by default; CRM_TEST_DATABASE_URL runs the same tests against a scratch Postgres (wiped first)
    pg_url = os.environ.get("CRM_TEST_DATABASE_URL")
    if pg_url:
        import psycopg
        with psycopg.connect(pg_url, autocommit=True) as conn:
            conn.execute("DROP TABLE IF EXISTS records, record_moves; DROP SEQUENCE IF EXISTS records_seq_counter")
        os.environ["DATABASE_URL"] = pg_url
    else:
        os.environ.pop("DATABASE_URL", None)
    os.environ["CRM_SQLITE_PATH"] = str(tmp_path_factory.mktemp("db") / "crm.sqlite3")
    os.environ["BROADCAST_POLLERS_DISABLED"] = "1"

    creds = {u["email"]: f"Test-{secrets.token_hex(6)}" for u in database.USERS_DB}
    path = tmp_path_factory.mktemp("secrets") / "credentials.json"
    path.write_text(json.dumps([{"email": e, "password": p} for e, p in creds.items()]))
    os.environ["CRM_CREDENTIALS_FILE"] = str(path)
    os.environ["JWT_SECRET_KEY"] = secrets.token_hex(32)

    import backend.store as store
    store.reset_backend()
    import backend.auth as auth
    import backend.signatures as signatures
    import backend.leegality as leegality
    import backend.broadcasts as broadcasts
    import backend.reports as reports
    import backend.sync as sync
    import backend.db_init as db_init
    for module in (store, auth, signatures, leegality, broadcasts, reports, sync, db_init):
        importlib.reload(module)
    data_dir = tmp_path_factory.mktemp("data")
    # Never import the real backend/data files into the test database
    db_init.DATA_DIR = str(data_dir)
    import backend.main as main
    main = importlib.reload(main)
    # Broadcasts never read the real backend/.env in tests
    broadcasts.ENV_PATH = str(data_dir / "broadcasts.env")

    client = TestClient(main.app)
    ip_counter = iter(range(1, 10_000))

    def login(identifier, password=None, ip=None):
        # A distinct client IP per call keeps the per-IP limiter out of tests that are not about it.
        ip = ip or f"10.0.{next(ip_counter) // 250}.{next(ip_counter) % 250}"
        return client.post("/api/auth/login",
                           json={"email": identifier, "password": password if password is not None else creds[identifier]},
                           headers={"x-real-ip": ip})

    def token(identifier):
        res = login(identifier)
        assert res.status_code == 200, res.text
        return res.json()["access_token"]

    return SimpleNamespace(client=client, creds=creds, main=main, signatures=signatures, broadcasts=broadcasts, reports=reports,
                           store=store, login=login, token=token)


def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}
