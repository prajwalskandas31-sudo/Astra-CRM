import pytest

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
EXEC = "tajayvarma76@gmail.com"
EXEC_ID = "usr-3"


@pytest.fixture(scope="module")
def tokens(crm):
    return {"sa": crm.token(SA), "admin": crm.token(ADMIN), "exec": crm.token(EXEC)}


def put_user(crm, tok, user_id, body):
    return crm.client.put(f"/api/users/{user_id}", json=body, headers=bearer(tok)).status_code


# ---- Data exposure

def test_no_password_hashes_anywhere(crm, tokens):
    for role in tokens:
        users = crm.client.get("/api/users", headers=bearer(tokens[role])).json()
        assert all("passwordHash" not in u and "password" not in u and "tokenVersion" not in u for u in users)
    me = crm.client.get("/api/auth/me", headers=bearer(tokens["exec"])).json()
    assert "passwordHash" not in me


def test_personal_fields_hidden_from_non_admins(crm, tokens):
    users = crm.client.get("/api/users", headers=bearer(tokens["exec"])).json()
    others = [u for u in users if u["id"] != EXEC_ID]
    assert others and all("bankAccountNumber" not in u and "documents" not in u for u in others)
    admin_view = crm.client.get("/api/users", headers=bearer(tokens["admin"])).json()
    assert any("bankAccountNumber" in u for u in admin_view)


def test_documents_only_for_self_or_admin(crm, tokens):
    assert crm.client.get("/api/users/usr-1/documents", headers=bearer(tokens["exec"])).status_code == 404
    assert crm.client.get(f"/api/users/{EXEC_ID}/documents", headers=bearer(tokens["exec"])).status_code == 200
    assert crm.client.get(f"/api/users/{EXEC_ID}/documents", headers=bearer(tokens["admin"])).status_code == 200


def test_reference_data_requires_login(crm):
    for path in ("/api/dispositions", "/api/custom-roles", "/api/leads", "/api/sales"):
        assert crm.client.get(path).status_code in (401, 403), path


# ---- Privilege escalation

@pytest.mark.parametrize("body", [{"role": "Super Admin"}, {"email": "x@y.z"}, {"name": "ABHINAYA M"}, {"documents": []}])
def test_executive_cannot_change_identity_fields(crm, tokens, body):
    assert put_user(crm, tokens["exec"], EXEC_ID, body) == 403


def test_executive_can_edit_own_contact_details(crm, tokens):
    assert put_user(crm, tokens["exec"], EXEC_ID, {"mobile": "9000000001", "ifscCode": "HDFC0000001"}) == 200


def test_executive_cannot_edit_others(crm, tokens):
    assert put_user(crm, tokens["exec"], "usr-1", {"mobile": "9000000002"}) == 403


def test_admin_limits(crm, tokens):
    admin = tokens["admin"]
    assert put_user(crm, admin, "usr-1", {"mobile": "9000000003"}) == 403
    assert put_user(crm, admin, EXEC_ID, {"role": "Admin"}) == 403
    # The edit form resends unchanged fields; that must not count as a role/email change.
    assert put_user(crm, admin, EXEC_ID, {"role": "Executive", "email": EXEC, "reportingTo": "Priya Nair"}) == 200
    assert crm.client.put("/api/users/usr-1/toggle-status", headers=bearer(admin)).status_code == 403


@pytest.mark.parametrize("method,path,body", [
    ("post", "/api/users", {"name": "x", "mobile": "9111111111", "password": "Long-Enough-123", "email": "n@x.com"}),
    ("put", "/api/users/usr-1/password", {"newPassword": "Hacked-Password-1"}),
    ("post", "/api/sales/x/approve", None),
    ("post", "/api/dispositions", {"name": "x"}),
    ("delete", "/api/users/usr-9", None),
    ("post", "/api/leads/reassign", {"fromUserId": "ALL", "toUserId": EXEC_ID}),
])
def test_executive_blocked_from_admin_actions(crm, tokens, method, path, body):
    kwargs = {"headers": bearer(tokens["exec"])}
    if body is not None:
        kwargs["json"] = body
    assert crm.client.request(method.upper(), path, **kwargs).status_code == 403


def test_leegality_is_super_admin_only(crm, tokens):
    assert crm.client.get("/api/leegality/wallet", headers=bearer(tokens["admin"])).status_code == 403


def test_super_admin_cannot_lock_themselves_out(crm, tokens):
    sa = tokens["sa"]
    assert put_user(crm, sa, "usr-1", {"role": "Admin"}) == 400
    assert crm.client.put("/api/users/usr-1/toggle-status", headers=bearer(sa)).status_code == 400
    assert crm.client.delete("/api/users/usr-1", headers=bearer(sa)).status_code == 400


# ---- Lead visibility

def test_leads_scoped_by_owner_id(crm, tokens):
    leads = crm.main.LEADS_DB
    leads.append({"id": "ld-other", "assignedToId": "usr-2", "assignedToName": "ABHINAYA M", "history": []})
    leads.append({"id": "ld-name-collide", "assignedToId": "usr-2", "assignedToName": "AJAY", "history": []})
    leads.append({"id": "ld-mine", "assignedToId": EXEC_ID, "assignedToName": "AJAY", "history": []})
    leads.append({"id": "ld-legacy", "assignedToName": "AJAY", "history": []})

    visible = {l["id"] for l in crm.client.get("/api/leads", headers=bearer(tokens["exec"])).json()}
    assert visible == {"ld-mine", "ld-legacy"}
    assert crm.client.post("/api/leads/ld-other/disposition", json={"dispositionName": "Hot"},
                           headers=bearer(tokens["exec"])).status_code == 404
    all_ids = {l["id"] for l in crm.client.get("/api/leads", headers=bearer(tokens["sa"])).json()}
    assert {"ld-other", "ld-mine"} <= all_ids


# ---- Identity uniqueness & password policy

def test_identity_fields_must_be_unique(crm, tokens):
    sa = tokens["sa"]
    base = {"name": "New Person", "mobile": "9000011111", "password": "Strong-Password-1", "email": "np@x.com", "reportingTo": "x"}
    assert crm.client.post("/api/users", json={**base, "employeeId": "EMP-001"}, headers=bearer(sa)).status_code == 400
    assert crm.client.post("/api/users", json={**base, "email": SA}, headers=bearer(sa)).status_code == 400
    assert crm.client.post("/api/users", json={**base, "name": "akshata"}, headers=bearer(sa)).status_code == 400
    assert crm.client.post("/api/users", json={**base, "mobile": "98765 43210"}, headers=bearer(sa)).status_code == 400
    assert put_user(crm, sa, "usr-4", {"mobile": "9876543210"}) == 400
    assert put_user(crm, sa, "usr-4", {"name": "ANITHA"}) == 400
    assert crm.client.post("/api/users", json=base, headers=bearer(sa)).status_code == 200


@pytest.mark.parametrize("password", ["123456", "short", "password123", "admin123"])
def test_weak_passwords_rejected(crm, tokens, password):
    body = {"name": f"Weak {password}", "mobile": "9222222222", "password": password, "email": f"w{password}@x.com", "reportingTo": "x"}
    assert crm.client.post("/api/users", json=body, headers=bearer(tokens["sa"])).status_code == 400
