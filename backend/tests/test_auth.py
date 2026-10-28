import secrets

import jwt

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
EXEC = "tajayvarma76@gmail.com"
# Generated per run so no credential-shaped literals live in the repo.
NEW_PASSWORD = f"Np-{secrets.token_hex(8)}"


def test_login_by_email_employee_id_and_mobile(crm):
    pw = crm.creds[SA]
    for identifier in (SA, "SUPERADMIN@company.com", "EMP-001", "9876543210", "+98765 43210"):
        assert crm.login(identifier, pw).status_code == 200, identifier


def test_old_seed_and_master_passwords_rejected(crm):
    for pw in ("admin123", "superadmin123", "123456"):
        assert crm.login(ADMIN, pw).status_code == 401


def test_login_response_has_no_secrets(crm):
    user = crm.login(SA).json()["user"]
    assert "password" not in user and "passwordHash" not in user


def test_letters_mixed_with_digits_are_not_a_mobile(crm):
    assert crm.login("abc9845011223", crm.creds["vikram.manager@company.com"]).status_code == 401


def test_account_lockout_shared_across_identifier_spellings(crm):
    variants = ["9741238901", "+9741238901", "97412-38901", "97412 38901", "(97412)38901", "priya.tl@company.com"]
    codes = [crm.login(v, "wrong-password").status_code for v in variants]
    assert codes[:5] == [401] * 5
    assert codes[5] == 429
    # Even the right password is refused while locked.
    assert crm.login("priya.tl@company.com").status_code == 429


def test_per_ip_limit_is_looser_than_per_account(crm):
    ip = "203.0.113.7"
    for i in range(6):
        crm.login(f"nobody{i}@example.com", "wrong", ip=ip)
    # Six failures across different accounts from one office IP must not lock out a colleague.
    assert crm.login(ADMIN, ip=ip).status_code == 200


def test_exact_identity_beats_colliding_mobile(crm):
    users = crm.main.USERS_DB
    priya = next(u for u in users if u["email"] == "anitha.y@company.com")
    other = next(u for u in users if u["email"] == "anuradha.n@company.com")
    priya["employeeId"], other["mobile"] = "5551234567", "5551234567"
    res = crm.login("5551234567", crm.creds["anitha.y@company.com"])
    assert res.status_code == 200 and res.json()["user"]["email"] == "anitha.y@company.com"


def test_forged_and_unsigned_tokens_rejected(crm):
    claims = {"sub": "usr-1", "ver": 0, "exp": 9_999_999_999}
    old_key = jwt.encode(claims, "srinivas_crm_super_secret_jwt_key_2026", algorithm="HS256")
    unsigned = jwt.encode(claims, None, algorithm="none")
    for tok in (old_key, unsigned, "garbage"):
        assert crm.client.get("/api/auth/me", headers=bearer(tok)).status_code == 401
    assert crm.client.get("/api/users").status_code in (401, 403)


def test_password_change_and_deactivation_revoke_sessions(crm):
    sa = crm.token(SA)
    exec_user = crm.login(EXEC).json()
    old = exec_user["access_token"]
    uid = exec_user["user"]["id"]

    assert crm.client.put(f"/api/users/{uid}/password", json={"newPassword": NEW_PASSWORD}, headers=bearer(sa)).status_code == 200
    assert crm.client.get("/api/auth/me", headers=bearer(old)).status_code == 401

    fresh = crm.login(EXEC, NEW_PASSWORD).json()["access_token"]
    assert crm.client.put(f"/api/users/{uid}/toggle-status", headers=bearer(sa)).status_code == 200
    assert crm.client.get("/api/auth/me", headers=bearer(fresh)).status_code in (401, 403)
    assert crm.login(EXEC, NEW_PASSWORD).status_code == 403


def test_verify_password_scopes(crm):
    admin = crm.token(ADMIN)
    sa = crm.token(SA)
    url = "/api/auth/verify-password"
    assert crm.client.post(url, json={"password": crm.creds[ADMIN]}, headers=bearer(admin)).status_code == 200
    assert crm.client.post(url, json={"password": crm.creds[SA]}, headers=bearer(admin)).status_code == 401
    assert crm.client.post(url, json={"password": crm.creds[SA], "scope": "admin"}, headers=bearer(admin)).status_code == 200
    tl_pw = crm.creds["vikram.manager@company.com"]
    assert crm.client.post(url, json={"password": tl_pw, "scope": "admin"}, headers=bearer(sa)).status_code == 401


def test_api_docs_not_exposed(crm):
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert crm.client.get(path).status_code == 404
