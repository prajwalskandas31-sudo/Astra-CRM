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
    """A fresh backend (seed data, random credentials, new JWT secret) for each test module."""
    import backend.database as database
    importlib.reload(database)

    creds = {u["email"]: f"Test-{secrets.token_hex(6)}" for u in database.USERS_DB}
    path = tmp_path_factory.mktemp("secrets") / "credentials.json"
    path.write_text(json.dumps([{"email": e, "password": p} for e, p in creds.items()]))
    os.environ["CRM_CREDENTIALS_FILE"] = str(path)
    os.environ["JWT_SECRET_KEY"] = secrets.token_hex(32)

    import backend.auth as auth
    import backend.signatures as signatures
    import backend.leegality as leegality
    import backend.main as main
    for module in (auth, signatures, leegality, main):
        importlib.reload(module)
    signatures.SIGNATURES_PATH = str(tmp_path_factory.mktemp("data") / "signatures.json")

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

    return SimpleNamespace(client=client, creds=creds, main=main, signatures=signatures, login=login, token=token)


def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}
