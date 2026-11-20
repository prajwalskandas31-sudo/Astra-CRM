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
    import backend.email_kit as email_kit
    import backend.client_info_telegram as client_info_telegram
    import backend.invoice as invoice
    import backend.old_client_review as old_client_review
    import backend.service_expiry as service_expiry
    import backend.email_failures as email_failures
    import backend.broadcast_group as broadcast_group
    import backend.kra as kra
    import backend.client_master as client_master
    import backend.invoice_block as invoice_block
    import backend.salary as salary
    import backend.pdf_tables as pdf_tables
    import backend.running_account as running_account
    import backend.audit_report as audit_report
    import backend.ra_periodic_report as ra_periodic_report
    import backend.annexure_a_saas as annexure_a_saas
    import backend.ra_compliance as ra_compliance
    import backend.db_init as db_init
    for module in (store, auth, signatures, leegality, broadcasts, reports, sync, email_kit, client_info_telegram, invoice, old_client_review, service_expiry, email_failures, broadcast_group, kra, client_master, invoice_block, salary, pdf_tables, running_account, audit_report, ra_periodic_report, annexure_a_saas, ra_compliance, db_init):
        importlib.reload(module)
    data_dir = tmp_path_factory.mktemp("data")
    # Never import the real backend/data files into the test database
    db_init.DATA_DIR = str(data_dir)
    import backend.main as main
    main = importlib.reload(main)
    # Broadcasts never read the real backend/.env in tests
    broadcasts.ENV_PATH = str(data_dir / "broadcasts.env")
    client_info_telegram.ENV_PATH = str(data_dir / "client_info.env")
    broadcast_group.ENV_PATH = str(data_dir / "broadcast_group.env")

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
                           store=store, email_kit=email_kit, service_expiry=service_expiry, email_failures=email_failures, leegality=leegality,
                           client_info_telegram=client_info_telegram, old_client_review=old_client_review, invoice=invoice,
                           broadcast_group=broadcast_group, kra=kra, client_master=client_master, invoice_block=invoice_block, login=login, token=token)


def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}
