import pytest

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
EXEC = "tajayvarma76@gmail.com"      # usr-3 (AJAY)
OTHER_EXEC = "anitha.y@company.com"  # usr-6, a different team


@pytest.fixture(scope="module")
def tok(crm):
    tokens = {k: crm.token(v) for k, v in {"sa": SA, "exec": EXEC, "other": OTHER_EXEC}.items()}
    res = crm.client.post("/api/sync", headers=bearer(tokens["sa"]), json={"collections": {
        "leads": {"upserts": [
            {"id": "pan-lead-1", "assignedToId": "usr-6", "assigned_user_id": "usr-6", "history": [],
             "clientInfo": {"panNumber": "AAAPL1111A"}},
        ]},
        "sales": {"upserts": [
            {"id": "pan-sale-ok", "leadId": "pan-lead-2", "submittedByUserId": "usr-6", "panNumber": "BBBPL2222B",
             "status": "Pending Super Admin Review"},
            {"id": "pan-sale-no", "leadId": "pan-lead-3", "submittedByUserId": "usr-6", "panNumber": "CCCPL3333C",
             "status": "Old Client - Declined", "stage": "Declined in Telegram Review"},
        ]},
        "paidClients": {"upserts": [
            {"id": "pan-paid", "leadId": "pan-lead-4", "submittedByUserId": "usr-6", "panNumber": "dddpl4444d"},
        ]},
    }})
    assert res.status_code == 200 and not any(res.json()["rejected"].values()), res.text
    return tokens


def check(crm, token, pan, lead_id=""):
    return crm.client.get("/api/sync/pan-check", params={"pan": pan, "leadId": lead_id}, headers=bearer(token))


def test_pan_held_by_another_team_is_found_without_leaking_details(crm, tok):
    body = check(crm, tok["exec"], "aaapl1111a").json()
    assert body == {"exists": True, "source": "another lead's client information"}


def test_sales_and_paid_clients_count(crm, tok):
    assert check(crm, tok["exec"], "BBBPL2222B").json()["exists"] is True
    assert check(crm, tok["exec"], "DDDPL4444D").json() == {"exists": True, "source": "an existing paid client"}


def test_declined_sale_and_unknown_pan_are_free(crm, tok):
    assert check(crm, tok["exec"], "CCCPL3333C").json() == {"exists": False}
    assert check(crm, tok["exec"], "ZZZPZ9999Z").json() == {"exists": False}


def test_clients_own_lead_does_not_count(crm, tok):
    assert check(crm, tok["other"], "AAAPL1111A", "pan-lead-1").json() == {"exists": False}
    assert check(crm, tok["other"], "BBBPL2222B", "pan-lead-2").json() == {"exists": False}


def test_invalid_pan_and_anonymous_are_refused(crm, tok):
    assert check(crm, tok["exec"], "ABC%").status_code == 400
    assert crm.client.get("/api/sync/pan-check", params={"pan": "AAAPL1111A"}).status_code in (401, 403)


def test_pan_index_follows_edits_and_deletes(crm, tok):
    sa = bearer(tok["sa"])
    lead = {"id": "pan-lead-edit", "assignedToId": "usr-6", "assigned_user_id": "usr-6", "history": [],
            "clientInfo": {"panNumber": "EEEPL5555E"}}
    assert crm.client.post("/api/sync", headers=sa, json={"collections": {"leads": {"upserts": [lead]}}}).status_code == 200
    assert check(crm, tok["exec"], "EEEPL5555E").json()["exists"] is True

    # The PAN is corrected on the same lead: the old one is free again, the new one is on file
    lead["clientInfo"] = {"panNumber": "FFFPL6666F"}
    assert crm.client.post("/api/sync", headers=sa, json={"collections": {"leads": {"upserts": [lead]}}}).status_code == 200
    assert check(crm, tok["exec"], "EEEPL5555E").json() == {"exists": False}
    assert check(crm, tok["exec"], "FFFPL6666F").json()["exists"] is True

    assert crm.client.post("/api/sync", headers=sa, json={"collections": {"leads": {"deletes": ["pan-lead-edit"]}}}).status_code == 200
    assert check(crm, tok["exec"], "FFFPL6666F").json() == {"exists": False}


def test_pan_index_is_built_for_records_written_before_it(crm, tok):
    """Records stored before the PAN index existed (an older deploy) are indexed on first use."""
    store = crm.store
    db = store.backend()
    with store.transaction():
        with store._conn() as conn:
            conn.execute(db.sql("DELETE FROM record_keys WHERE collection = ?"), ("paidClients",))
            conn.execute(db.sql("DELETE FROM record_keys_built WHERE collection = ?"), ("paidClients",))
    store._keys_ready.discard("paidClients")
    assert check(crm, tok["exec"], "DDDPL4444D").json() == {"exists": True, "source": "an existing paid client"}
