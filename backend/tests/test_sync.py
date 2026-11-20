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


def test_company_profile_is_read_by_all_and_changed_only_by_super_admin(crm, tok):
    entry = {"id": "sebiRegistrationNumber", "value": "INH000012345"}
    assert push(crm, tok["admin"], "companyProfile", [entry])["rejected"]["companyProfile"]
    assert push(crm, tok["exec"], "companyProfile", [entry])["rejected"]["companyProfile"]
    assert not push(crm, tok["sa"], "companyProfile", [entry])["rejected"]["companyProfile"]
    seen = {i["id"]: i["value"] for i in pull(crm, tok["exec"], "companyProfile")["collections"]["companyProfile"]["items"]}
    assert seen["sebiRegistrationNumber"] == "INH000012345"


def test_login_disclaimer_is_read_by_all_and_changed_only_by_super_admin(crm, tok):
    entry = {"id": "message", "value": "Client data is confidential.\nDo not share it."}
    assert push(crm, tok["admin"], "loginDisclaimer", [entry])["rejected"]["loginDisclaimer"]
    assert push(crm, tok["exec"], "loginDisclaimer", [entry])["rejected"]["loginDisclaimer"]
    assert not push(crm, tok["sa"], "loginDisclaimer", [entry])["rejected"]["loginDisclaimer"]
    assert not push(crm, tok["sa"], "loginDisclaimer", [{"id": "enabled", "value": False}])["rejected"]["loginDisclaimer"]
    seen = {i["id"]: i["value"] for i in pull(crm, tok["exec"], "loginDisclaimer")["collections"]["loginDisclaimer"]["items"]}
    assert seen == {"message": entry["value"], "enabled": False}


def test_login_disclaimer_rejects_bad_settings(crm, tok):
    bad = [
        {"id": "buttonColor", "value": "red"},           # unknown setting
        {"id": "enabled", "value": "yes"},                # wrong type
        {"id": "message", "value": "   "},                # empty message
        {"id": "message", "value": "x" * 10001},          # too long
        {"id": "title", "value": "t" * 151},
    ]
    for entry in bad:
        assert push(crm, tok["sa"], "loginDisclaimer", [entry])["rejected"]["loginDisclaimer"], entry


def test_company_bank_accounts_sync_as_a_list(crm, tok):
    accounts = [{"id": "bank-1", "bankName": "HDFC Bank", "accountNumber": "50200012345678", "ifscCode": "HDFC0001234",
                 "accountType": "Current", "bankBranch": "Surat", "upiId": "co@hdfcbank", "paymentGatewayLink": ""}]
    entry = {"id": "bankAccounts", "value": accounts}
    assert push(crm, tok["admin"], "companyProfile", [entry])["rejected"]["companyProfile"]
    assert not push(crm, tok["sa"], "companyProfile", [entry])["rejected"]["companyProfile"]
    seen = {i["id"]: i["value"] for i in pull(crm, tok["exec"], "companyProfile")["collections"]["companyProfile"]["items"]}
    assert seen["bankAccounts"] == accounts
    script_link = {"id": "bankAccounts", "value": [{**accounts[0], "paymentGatewayLink": "javascript:alert(1)"}]}
    assert push(crm, tok["sa"], "companyProfile", [script_link])["rejected"]["companyProfile"]


def test_branches_are_read_by_all_and_changed_only_by_super_admin(crm, tok):
    branch = {"id": "br-1", "name": "Hyderabad", "address": "Ameerpet", "managerIds": ["usr-2"], "phone": "040 1234 5678"}
    assert push(crm, tok["admin"], "branches", [branch])["rejected"]["branches"]
    assert push(crm, tok["exec"], "branches", [branch])["rejected"]["branches"]
    assert not push(crm, tok["sa"], "branches", [branch])["rejected"]["branches"]
    assert "br-1" in ids(pull(crm, tok["exec"], "branches"), "branches")


def test_branch_id_is_unique_and_well_formed(crm, tok):
    a = {"id": "br-a", "name": "Surat", "branchCode": "br-001"}
    assert not push(crm, tok["sa"], "branches", [a])["rejected"]["branches"]
    assert crm.store.get("branches", "br-a")["branchCode"] == "BR-001"
    assert not push(crm, tok["sa"], "branches", [{**a, "address": "Althan"}])["rejected"]["branches"]   # same branch again
    assert push(crm, tok["sa"], "branches", [{"id": "br-b", "name": "Pune", "branchCode": "BR-001"}])["rejected"]["branches"]
    assert push(crm, tok["sa"], "branches", [{"id": "br-c", "name": "Goa", "branchCode": "BR 1!"}])["rejected"]["branches"]
    assert not push(crm, tok["sa"], "branches", [{"id": "br-d", "name": "Delhi", "branchCode": "BR-002"}])["rejected"]["branches"]


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


def calls(user_id, date, total, **by_disposition):
    return {"id": f"{user_id}:{date}", "userId": user_id, "date": date, "total": total, "byDisposition": by_disposition}


def attendance(user_id, date, status):
    return {"id": f"{user_id}:{date}", "userId": user_id, "date": date, "status": status}


def test_call_counts_are_kept_by_their_owner_and_read_by_the_team(crm, tok):
    assert not push(crm, tok["exec"], "callStats", [calls("usr-3", "2026-11-16", 3, Interested=2)])["rejected"]["callStats"]
    # Nobody counts calls for someone else, nor deletes them, nor stores bad numbers
    assert push(crm, tok["tl"], "callStats", [calls("usr-3", "2026-11-16", 99)])["rejected"]["callStats"]
    assert push(crm, tok["exec"], "callStats", [calls("usr-6", "2026-11-16", 1)])["rejected"]["callStats"]
    assert push(crm, tok["exec"], "callStats", deletes=["usr-3:2026-11-16"])["rejected"]["callStats"]
    assert push(crm, tok["exec"], "callStats", [calls("usr-3", "2026-11-17", -1)])["rejected"]["callStats"]
    assert push(crm, tok["exec"], "callStats", [calls("usr-3", "2026-11-17", 1, Interested="9")])["rejected"]["callStats"]
    assert push(crm, tok["exec"], "callStats", [{**calls("usr-3", "2026-11-18", 1), "id": "usr-3:other"}])["rejected"]["callStats"]

    # Admins may correct anyone's; each person reads only their own team's counts
    assert not push(crm, tok["admin"], "callStats", [calls("usr-6", "2026-11-16", 4)])["rejected"]["callStats"]
    assert ids(pull(crm, tok["exec"], "callStats"), "callStats") == {"usr-3:2026-11-16"}
    assert "usr-3:2026-11-16" in ids(pull(crm, tok["tl"], "callStats"), "callStats")
    assert "usr-6:2026-11-16" not in ids(pull(crm, tok["tl"], "callStats"), "callStats")
    assert {"usr-3:2026-11-16", "usr-6:2026-11-16"} <= ids(pull(crm, tok["admin"], "callStats"), "callStats")


def test_attendance_is_marked_by_the_people_above(crm, tok):
    body = push(crm, tok["tl"], "attendance", [attendance("usr-3", "2026-11-16", "Present")])
    assert not body["rejected"]["attendance"]
    saved = crm.store.get("attendance", "usr-3:2026-11-16")
    assert saved["markedById"] == "usr-10" and saved["markedByName"]

    # Not for themselves, not outside their team, not with a made-up status
    assert push(crm, tok["exec"], "attendance", [attendance("usr-3", "2026-11-17", "Present")])["rejected"]["attendance"]
    assert push(crm, tok["tl"], "attendance", [attendance("usr-10", "2026-11-16", "Present")])["rejected"]["attendance"]
    assert push(crm, tok["tl"], "attendance", [attendance("usr-6", "2026-11-16", "Present")])["rejected"]["attendance"]
    assert push(crm, tok["tl"], "attendance", [attendance("usr-3", "2026-11-17", "Holiday")])["rejected"]["attendance"]
    assert push(crm, tok["exec"], "attendance", deletes=["usr-3:2026-11-16"])["rejected"]["attendance"]

    # Admins mark anyone; the executive sees their own day, but not others'
    assert not push(crm, tok["admin"], "attendance", [attendance("usr-6", "2026-11-16", "Leave")])["rejected"]["attendance"]
    assert ids(pull(crm, tok["exec"], "attendance"), "attendance") == {"usr-3:2026-11-16"}
    assert not push(crm, tok["tl"], "attendance", deletes=["usr-3:2026-11-16"])["rejected"]["attendance"]


def test_paid_clients_reach_whoever_registered_the_sale(crm, tok):
    push(crm, tok["admin"], "paidClients", [{"id": "paid-ajay", "submittedByUserId": "usr-3", "serviceName": "S"},
                                            {"id": "paid-anitha", "submittedByUserId": "usr-6", "serviceName": "S"}])
    assert ids(pull(crm, tok["exec"], "paidClients"), "paidClients") == {"paid-ajay"}
    assert "paid-ajay" in ids(pull(crm, tok["tl"], "paidClients"), "paidClients")
    assert {"paid-ajay", "paid-anitha"} <= ids(pull(crm, tok["admin"], "paidClients"), "paidClients")
    # Still only admins change them
    assert push(crm, tok["exec"], "paidClients", [{"id": "paid-ajay", "submittedByUserId": "usr-3", "serviceName": "X"}])["rejected"]["paidClients"]


def test_paid_clients_stored_before_owners_get_one_at_startup(crm, tok):
    import backend.db_init as db_init
    owner_fn = crm.store._owner_fns.pop("paidClients")
    try:
        crm.store.put("paidClients", "paid-old", {"id": "paid-old", "submittedByUserId": "usr-3", "serviceName": "S"})
    finally:
        crm.store.register_owner("paidClients", owner_fn)
    assert "paid-old" not in ids(pull(crm, tok["exec"], "paidClients"), "paidClients")

    crm.store.set_value("ownersBackfilled:paidClients", False)
    db_init._backfill_owners()
    assert "paid-old" in ids(pull(crm, tok["exec"], "paidClients"), "paidClients")
    assert crm.store.get_value("ownersBackfilled:paidClients") is True


def test_company_assets_are_super_admin_only_and_capped_at_ten(crm, tok):
    asset = {"id": "ast-1", "name": "Laptop"}
    assert push(crm, tok["admin"], "companyAssets", [asset])["rejected"]["companyAssets"]
    assert not push(crm, tok["sa"], "companyAssets", [asset])["rejected"]["companyAssets"]
    assert "ast-1" in ids(pull(crm, tok["exec"], "companyAssets"), "companyAssets")
    assert push(crm, tok["sa"], "companyAssets", [{"id": "ast-x", "name": "  "}])["rejected"]["companyAssets"]
    more = [{"id": f"ast-{n}", "name": f"Item {n}"} for n in range(2, 11)]
    assert not push(crm, tok["sa"], "companyAssets", more)["rejected"]["companyAssets"]
    assert push(crm, tok["sa"], "companyAssets", [{"id": "ast-11", "name": "One too many"}])["rejected"]["companyAssets"]
    # Renaming an existing item still works when the list is full
    assert not push(crm, tok["sa"], "companyAssets", [{"id": "ast-1", "name": "Laptop (Dell)"}])["rejected"]["companyAssets"]


def test_company_logo_and_nature_of_business(crm, tok):
    png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    svg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4="
    for entry in ({"id": "companyLogo", "value": png}, {"id": "companyLogo", "value": svg},
                  {"id": "companyLogo", "value": ""}, {"id": "natureOfBusiness", "value": "Research Analyst"},
                  {"id": "state", "value": "Gujarat"}, {"id": "state", "value": "Delhi (NCT)"}, {"id": "state", "value": ""}):
        assert not push(crm, tok["sa"], "companyProfile", [entry])["rejected"]["companyProfile"], entry
    assert push(crm, tok["admin"], "companyProfile", [{"id": "companyLogo", "value": png}])["rejected"]["companyProfile"]
    for bad in ({"id": "companyLogo", "value": "https://evil.example/logo.png"},
                {"id": "companyLogo", "value": "data:text/html;base64,PHNjcmlwdD4="},
                {"id": "companyLogo", "value": "data:image/png;base64," + "A" * 1_400_000},
                {"id": "natureOfBusiness", "value": "x" * 151},
                {"id": "state", "value": "x" * 61}, {"id": "state", "value": "Gujrat"}):
        assert push(crm, tok["sa"], "companyProfile", [bad])["rejected"]["companyProfile"], bad["value"][:40]


def test_service_master_names_are_unique_and_values_numeric(crm, tok):
    for d in crm.store.all("services"):
        crm.store.delete("services", d["id"])
    ok = {"id": "srv-a", "name": "  Stock Cash Premium ", "value": 15000}
    assert not push(crm, tok["sa"], "services", [ok])["rejected"]["services"]
    assert crm.store.get("services", "srv-a")["name"] == "Stock Cash Premium"
    assert not push(crm, tok["sa"], "services", [{"id": "srv-b", "name": "Bullions", "value": ""}])["rejected"]["services"]
    assert push(crm, tok["admin"], "services", [{"id": "srv-c", "name": "Energy", "value": 1}])["rejected"]["services"]
    for bad in ({"id": "srv-d", "name": "stock cash premium", "value": 1},   # same name, other case
                {"id": "srv-e", "name": "", "value": 1},
                {"id": "srv-f", "name": "Energy", "value": "lots"},
                {"id": "srv-g", "name": "Energy", "value": -5},
                {"id": "srv-h", "name": "x" * 61}):
        assert push(crm, tok["sa"], "services", [bad])["rejected"]["services"], bad
    assert not push(crm, tok["sa"], "services", [{**ok, "value": 18000}])["rejected"]["services"]   # edit itself


def test_research_recommendations_are_admin_only_and_checked(crm, tok):
    good = {"id": "rr-1", "srNo": "1", "date": "2026-11-20", "nature": " Intraday ", "product": "RELIANCE",
            "strikePrice": "2450", "period": "Intraday", "callPutHold": "Call", "buyRate": 2450.5, "sellRate": "",
            "rationaleMaintained": "Yes"}
    assert not push(crm, tok["sa"], "researchRecommendations", [good])["rejected"]["researchRecommendations"]
    saved = crm.store.get("researchRecommendations", "rr-1")
    assert saved["srNo"] == 1 and saved["nature"] == "Intraday"
    assert not push(crm, tok["admin"], "researchRecommendations", [{**good, "id": "rr-2", "srNo": 2}])["rejected"]["researchRecommendations"]
    assert push(crm, tok["tl"], "researchRecommendations", [{**good, "id": "rr-3"}])["rejected"]["researchRecommendations"]
    assert ids(pull(crm, tok["admin"], "researchRecommendations"), "researchRecommendations") >= {"rr-1", "rr-2"}
    assert not ids(pull(crm, tok["exec"], "researchRecommendations"), "researchRecommendations")
    for bad in ({"date": ""}, {"date": "20-11-2026"}, {"product": "  "}, {"srNo": 0}, {"srNo": "x"},
                {"callPutHold": "Buy"}, {"rationaleMaintained": "Maybe"}, {"buyRate": "lots"}, {"sellRate": -1},
                {"buyRate": True}, {"nature": "x" * 201}, {"strikePrice": "x" * 61}):
        assert push(crm, tok["sa"], "researchRecommendations", [{**good, "id": "rr-bad", **bad}])["rejected"]["researchRecommendations"], bad
    assert not push(crm, tok["sa"], "researchRecommendations", [{**good, "sellRate": 2470}])["rejected"]["researchRecommendations"]
