import json
import secrets

import pytest

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
TL = "priya.tl@company.com"          # usr-10, team: AJAY, ABHINAYA M, AKSHATA, ANITHA
EXEC = "tajayvarma76@gmail.com"      # usr-3 (AJAY), reports to Priya
OTHER_EXEC = "anitha.y@company.com"  # usr-6, reports straight to the Super Admin


@pytest.fixture(scope="module")
def tok(crm):
    return {k: crm.token(v) for k, v in
            {"sa": SA, "admin": ADMIN, "tl": TL, "exec": EXEC, "other": OTHER_EXEC}.items()}


def lead(lead_id, owner, **extra):
    return {"id": lead_id, "assignedToId": owner, "assigned_user_id": owner, "history": [], **extra}


def pull(crm, token, collections, since=0):
    res = crm.client.get("/api/sync", params={"collections": collections, "since": since}, headers=bearer(token))
    assert res.status_code == 200, res.text
    return res.json()


def push(crm, token, collection, upserts=(), deletes=()):
    res = crm.client.post("/api/sync", json={"collections": {collection: {"upserts": list(upserts), "deletes": list(deletes)}}},
                          headers=bearer(token))
    assert res.status_code == 200, res.text
    return res.json()


def ids(body, collection):
    return {i["id"] for i in body["collections"][collection]["items"]}


def test_leads_are_shared_and_scoped_by_team(crm, tok):
    body = push(crm, tok["sa"], "leads", [lead("s-1", "usr-3"), lead("s-2", "usr-2"), lead("s-3", "usr-6"),
                                          lead("s-pool", "unassigned", isUnassigned=True)])
    assert not body["rejected"]["leads"]

    assert ids(pull(crm, tok["exec"], "leads"), "leads") == {"s-1"}
    assert ids(pull(crm, tok["tl"], "leads"), "leads") >= {"s-1", "s-2"}
    assert "s-3" not in ids(pull(crm, tok["tl"], "leads"), "leads")
    assert {"s-1", "s-2", "s-3", "s-pool"} <= ids(pull(crm, tok["admin"], "leads"), "leads")


def test_executive_cannot_touch_or_take_others_leads(crm, tok):
    push(crm, tok["sa"], "leads", [lead("t-mine", "usr-3"), lead("t-theirs", "usr-6")])
    body = push(crm, tok["exec"], "leads", [lead("t-theirs", "usr-3"), lead("t-mine", "usr-6"),
                                            lead("t-mine", "usr-3", disposition="Interested")])
    rejected = {r["id"] for r in body["rejected"]["leads"]}
    assert rejected == {"t-theirs", "t-mine"} and body["saved"]["leads"] == ["t-mine"]
    assert crm.store.get("leads", "t-theirs")["assignedToId"] == "usr-6"
    assert crm.store.get("leads", "t-mine")["disposition"] == "Interested"
    # Executives cannot delete leads, even their own
    assert push(crm, tok["exec"], "leads", deletes=["t-mine"])["rejected"]["leads"]


def test_incremental_pull_and_reassignment_away(crm, tok):
    push(crm, tok["sa"], "leads", [lead("m-1", "usr-3")])
    cursor = pull(crm, tok["exec"], "leads")["cursor"]
    assert pull(crm, tok["exec"], "leads", cursor)["collections"]["leads"] == {"items": [], "deleted": []}

    push(crm, tok["sa"], "leads", [lead("m-1", "usr-6")])  # reassigned out of AJAY's team
    push(crm, tok["sa"], "leads", [lead("m-2", "usr-3")])
    delta = pull(crm, tok["exec"], "leads", cursor)
    assert ids(delta, "leads") == {"m-2"} and delta["collections"]["leads"]["deleted"] == ["m-1"]
    assert "m-1" in ids(pull(crm, tok["other"], "leads", cursor), "leads")

    push(crm, tok["sa"], "leads", deletes=["m-2"])
    assert pull(crm, tok["exec"], "leads", delta["cursor"])["collections"]["leads"]["deleted"] == ["m-2"]


def test_only_super_admin_approves_sales(crm, tok):
    sale = {"id": "sale-x", "submittedByUserId": "usr-3", "status": "Pending Super Admin Approval", "stage": "Sale Submitted"}
    assert not push(crm, tok["exec"], "sales", [sale])["rejected"]["sales"]
    approved = {**sale, "status": "Approved (eKYC Stage)"}
    assert push(crm, tok["exec"], "sales", [approved])["rejected"]["sales"]
    assert push(crm, tok["admin"], "sales", [approved])["rejected"]["sales"]
    assert push(crm, tok["exec"], "sales", [{**sale, "status": "Super Admin Approved (Voice Skipped)"}])["rejected"]["sales"]
    assert not push(crm, tok["sa"], "sales", [approved])["rejected"]["sales"]
    assert ids(pull(crm, tok["exec"], "sales"), "sales") == {"sale-x"}
    assert ids(pull(crm, tok["other"], "sales"), "sales") == set()


def test_admin_only_and_config_collections(crm, tok):
    assert push(crm, tok["exec"], "masterRecords", [{"id": "mr-1", "phone": "9000000001"}])["rejected"]["masterRecords"]
    assert pull(crm, tok["exec"], "masterRecords")["collections"]["masterRecords"]["items"] == []
    assert push(crm, tok["admin"], "services", [{"id": "srv-x", "name": "X"}])["rejected"]["services"]
    assert not push(crm, tok["sa"], "services", [{"id": "srv-x", "name": "X"}])["rejected"]["services"]
    assert "srv-x" in ids(pull(crm, tok["exec"], "services"), "services")
    assert crm.client.get("/api/sync", params={"collections": "users"}, headers=bearer(tok["sa"])).status_code == 404


def test_override_passwords_only_reach_admins(crm, tok):
    push(crm, tok["sa"], "financialSettings", [{"id": "adminOverridePassword", "value": "s3cret-override"},
                                               {"id": "maxGrossSales", "value": 200000}])
    seen = {i["id"]: i["value"] for i in pull(crm, tok["exec"], "financialSettings")["collections"]["financialSettings"]["items"]}
    assert seen == {"adminOverridePassword": None, "maxGrossSales": 200000}
    # A Super Admin pushing back a redacted copy cannot wipe the real value
    push(crm, tok["sa"], "financialSettings", [{"id": "adminOverridePassword", "value": None}])
    assert crm.store.get("financialSettings", "adminOverridePassword")["value"] == "s3cret-override"


def test_notifications_reach_their_target(crm, tok):
    push(crm, tok["exec"], "notifications", [{"id": "n-all", "title": "hi"},
                                             {"id": "n-sa", "title": "review", "targetRole": "Super Admin"},
                                             {"id": "n-other", "title": "x", "targetUserId": "usr-6"}])
    assert {"n-all"} == ids(pull(crm, tok["exec"], "notifications"), "notifications") & {"n-all", "n-sa", "n-other"}
    assert {"n-all", "n-sa", "n-other"} <= ids(pull(crm, tok["sa"], "notifications"), "notifications")


def test_deleted_paid_client_stays_deleted(crm, tok):
    push(crm, tok["admin"], "paidClients", [{"id": "paid-1", "phone": "9876500001", "serviceName": "S"}])
    push(crm, tok["admin"], "paidClients", deletes=["paid-1"])
    assert push(crm, tok["sa"], "paidClients", [{"id": "paid-1", "phone": "9876500001"}])["rejected"]["paidClients"]
    assert crm.store.get("paidClients", "paid-1") is None


def test_push_size_is_limited(crm, tok):
    res = crm.client.post("/api/sync", json={"collections": {"leads": {"upserts": [lead(f"x{i}", "usr-3") for i in range(5001)]}}},
                          headers=bearer(tok["sa"]))
    assert res.status_code == 413


def test_data_and_password_changes_survive_restart(crm, tok, tmp_path):
    new_password = f"Np-{secrets.token_hex(8)}"
    res = crm.client.put("/api/users/usr-6/password", json={"newPassword": new_password}, headers=bearer(tok["sa"]))
    assert res.status_code == 200
    push(crm, tok["sa"], "leads", [lead("persist-1", "usr-3")])

    # A restart runs init again; it must neither re-seed (resetting passwords) nor lose records
    import backend.db_init as db_init
    assert db_init.init_database(str(tmp_path))["seeded"] is False
    crm.store.reset_backend()
    assert crm.store.get("leads", "persist-1") is not None
    assert crm.login(OTHER_EXEC, new_password).status_code == 200


def test_legacy_files_are_imported_once(crm, tmp_path):
    import backend.db_init as db_init
    (tmp_path / "paid_clients.json").write_text(json.dumps([{"id": "legacy-paid", "phone": "9876500009"}]))
    (tmp_path / "signatures.json").write_text(json.dumps({"master_officer": {"signatureDataUrl": ""}}))
    assert set(db_init.init_database(str(tmp_path))["imported"]) == {"paid_clients.json", "signatures.json"}
    crm.store.delete("paidClients", "legacy-paid")
    assert db_init.init_database(str(tmp_path))["imported"] == []
    assert crm.store.get("paidClients", "legacy-paid") is None


def test_sales_move_only_through_super_admin(crm, tok):
    pending = {"id": "sale-flow", "submittedByUserId": "usr-3", "status": "Pending Super Admin Review", "stage": "Under Review by Super Admin"}
    assert push(crm, tok["exec"], "sales", [{**pending, "id": "sale-bad", "status": "E-Signed & Converted"}])["rejected"]["sales"]
    assert push(crm, tok["exec"], "sales", [{**pending, "id": "sale-bad2", "status": "Approved, not pending"}])["rejected"]["sales"]
    assert not push(crm, tok["exec"], "sales", [pending])["rejected"]["sales"]
    assert not push(crm, tok["exec"], "sales", [{**pending, "amount": "50000"}])["rejected"]["sales"]  # own pending sale
    assert push(crm, tok["exec"], "sales", [{**pending, "stage": "eKYC Approved"}])["rejected"]["sales"]
    dispatched = {**pending, "status": "e-KYC & E-Sign Dispatched", "stage": "Dispatched"}
    assert push(crm, tok["admin"], "sales", [dispatched])["rejected"]["sales"]
    assert not push(crm, tok["sa"], "sales", [dispatched])["rejected"]["sales"]
    assert push(crm, tok["exec"], "sales", [{**dispatched, "amount": "1"}])["rejected"]["sales"]
    assert push(crm, tok["exec"], "sales", deletes=["sale-flow"])["rejected"]["sales"]


def test_notification_ownership(crm, tok):
    push(crm, tok["sa"], "notifications", [{"id": "n-global", "title": "System"}])
    body = push(crm, tok["exec"], "notifications", [{"id": "n-mine", "title": "Mine", "targetRole": "Super Admin"}])
    assert not body["rejected"]["notifications"]
    assert crm.store.get("notifications", "n-mine")["createdByUserId"] == "usr-3"
    assert push(crm, tok["tl"], "notifications", [{"id": "n-fake", "title": "x", "createdByUserId": "usr-3"}])["rejected"]["notifications"]
    # Everyone may mark a global notice read, nobody else may rewrite or delete it
    assert not push(crm, tok["exec"], "notifications", [{"id": "n-global", "title": "System", "read": True}])["rejected"]["notifications"]
    assert push(crm, tok["exec"], "notifications", [{"id": "n-global", "title": "Hacked"}])["rejected"]["notifications"]
    assert push(crm, tok["exec"], "notifications", deletes=["n-global"])["rejected"]["notifications"]
    assert not push(crm, tok["exec"], "notifications", deletes=["n-mine"])["rejected"]["notifications"]
