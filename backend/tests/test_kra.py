"""KRA Block: access via Feature Access, team scoping, Trigger KRA and the saved PDF.
CVL KRA is replaced by a fake; nothing leaves the machine."""
import pytest

from backend.tests.conftest import bearer

SA, ADMIN, TL, EXEC = "superadmin@company.com", "admin@company.com", "priya.tl@company.com", "tajayvarma76@gmail.com"

ROWS = [("Name", "SINGH SAURAV SANJAY"), ("PAN", "HQAPS3584N"), ("KRA Name", "NDML - KRA"),
        ("KYC Status", "KYC VALIDATED"), ("KYC Mode", "DIGILOCKER"), ("IPV Flag", "Y")]


@pytest.fixture
def kra(crm):
    for name in ("kraRecords", "kraFiles"):
        crm.store.delete_many(name, [d["id"] for d in crm.store.all(name)])
    for uid in ("usr-10", "usr-11"):
        crm.store.delete("userPermissions", uid)
    # Priya's team (usr-3) and someone outside it (usr-6)
    crm.store.put("sales", "SL-kra-1", {"id": "SL-kra-1", "clientName": "Saurav", "panNumber": "HQAPS3584N",
                                        "submittedByUserId": "usr-3", "fullClientInfo": {"clientName": "Singh Saurav Sanjay"}})
    crm.store.put("sales", "SL-kra-2", {"id": "SL-kra-2", "clientName": "Other", "panNumber": "ABCDE1234F",
                                        "submittedByUserId": "usr-6"})
    crm.store.put("sales", "SL-kra-3", {"id": "SL-kra-3", "clientName": "No PAN", "panNumber": "",
                                        "submittedByUserId": "usr-3"})
    return crm.kra


def fake_cvl(kra, monkeypatch):
    monkeypatch.setattr(kra, "fetch_from_cvl", lambda pan: ROWS)


def test_executive_has_no_access_by_default(crm, kra):
    res = crm.client.get("/api/kra/records", headers=bearer(crm.token(EXEC)))
    assert res.status_code == 403


def test_trigger_without_cvl_connection_saves_nothing(crm, kra):
    h = bearer(crm.token(ADMIN))
    listing = crm.client.get("/api/kra/records", headers=h).json()
    assert listing == {"connectorReady": False, "records": []}
    res = crm.client.post("/api/kra/sales/SL-kra-1/trigger", headers=h)
    assert res.status_code == 503
    assert "not set up" in res.json()["detail"]
    assert crm.store.all("kraRecords") == []


def test_trigger_saves_pdf_and_lists_it(crm, kra, monkeypatch):
    fake_cvl(kra, monkeypatch)
    h = bearer(crm.token(ADMIN))
    res = crm.client.post("/api/kra/sales/SL-kra-1/trigger", headers=h)
    assert res.status_code == 200, res.text
    record = res.json()
    assert record["pan"] == "HQAPS3584N" and record["kycStatus"] == "KYC VALIDATED" and record["kraName"] == "NDML - KRA"
    assert record["clientName"] == "Singh Saurav Sanjay" and record["fileName"].startswith("KRA_HQAPS3584N_")
    assert "ownerId" not in record

    records = crm.client.get("/api/kra/records", headers=h).json()["records"]
    assert [r["id"] for r in records] == [record["id"]]
    pdf = crm.client.get(f"/api/kra/records/{record['id']}/pdf", headers=h)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert record["fileName"] in pdf.headers["content-disposition"]


def test_client_without_valid_pan_is_refused(crm, kra, monkeypatch):
    fake_cvl(kra, monkeypatch)
    res = crm.client.post("/api/kra/sales/SL-kra-3/trigger", headers=bearer(crm.token(ADMIN)))
    assert res.status_code == 400


def test_feature_access_grant_is_scoped_to_own_team(crm, kra, monkeypatch):
    fake_cvl(kra, monkeypatch)
    crm.store.put("userPermissions", "usr-10", {"id": "usr-10", "value": {"kra-block": True}})
    h = bearer(crm.token(TL))
    assert crm.client.post("/api/kra/sales/SL-kra-1/trigger", headers=h).status_code == 200
    assert crm.client.post("/api/kra/sales/SL-kra-2/trigger", headers=h).status_code == 404

    # The Admin's KRA of the other team's client stays invisible to the Team Leader
    other = crm.client.post("/api/kra/sales/SL-kra-2/trigger", headers=bearer(crm.token(ADMIN))).json()
    mine = crm.client.get("/api/kra/records", headers=h).json()["records"]
    assert [r["saleId"] for r in mine] == ["SL-kra-1"]
    assert crm.client.get(f"/api/kra/records/{other['id']}/pdf", headers=h).status_code == 404


def test_feature_access_can_switch_admin_off(crm, kra):
    crm.store.put("userPermissions", "usr-11", {"id": "usr-11", "value": {"kra-block": False}})
    assert crm.client.get("/api/kra/records", headers=bearer(crm.token(ADMIN))).status_code == 403
    assert crm.client.get("/api/kra/records", headers=bearer(crm.token(SA))).status_code == 200
