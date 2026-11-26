"""RA Monthly Compliance Tracker: per-month sheets, shape checks and Feature Access."""
import pytest

from backend.tests.conftest import bearer

SA, ADMIN = "superadmin@company.com", "admin@company.com"
URL = "/api/ra-compliance"


@pytest.fixture
def crm_clean(crm):
    s = crm.store
    s.delete_many("raCompliance", [d["id"] for d in s.all("raCompliance")])
    return crm


def put(crm, sheet, data, month="2026-10", who=SA):
    return crm.client.put(f"{URL}/{sheet}", params={"month": month}, json={"data": data}, headers=bearer(crm.token(who)))


def get(crm, month="2026-10", who=SA):
    return crm.client.get(URL, params={"month": month}, headers=bearer(crm.token(who)))


def test_save_and_load_a_month(crm_clean):
    crm = crm_clean
    rows = [{"id": "c1", "name": "Rahul Sharma", "pan": "ABCDE1234F", "fees": 5900, "kyc": "Yes", "remarks": ""}]
    r = put(crm, "clientRegister", {"rows": rows})
    assert r.status_code == 200, r.text
    # empty values are not stored; who saved it is recorded
    assert r.json()["data"]["rows"] == [{"id": "c1", "name": "Rahul Sharma", "pan": "ABCDE1234F", "fees": 5900, "kyc": "Yes"}]
    assert r.json()["updatedBy"]

    assert put(crm, "scores", {"weeks": [{"id": "w1", "checked": "Yes"}], "log": []}).status_code == 200
    assert put(crm, "details", {"fields": {"bseEnlistment": "1234", "checkedBy": "CO"}}).status_code == 200

    body = get(crm).json()
    assert body["month"] == "2026-10"
    assert body["sheets"]["clientRegister"]["data"]["rows"][0]["name"] == "Rahul Sharma"
    assert body["sheets"]["scores"]["data"] == {"weeks": [{"id": "w1", "checked": "Yes"}], "log": []}
    assert body["sheets"]["details"]["data"] == {"fields": {"bseEnlistment": "1234", "checkedBy": "CO"}}
    # another month is separate
    assert get(crm, month="2026-11").json()["sheets"] == {}


def test_months_list_newest_first(crm_clean):
    crm = crm_clean
    put(crm, "socialBio", {"rows": [{"id": "a", "platform": "Instagram"}]}, month="2026-09")
    put(crm, "upiBank", {"rows": [{"id": "b", "bankName": "HDFC"}]}, month="2026-10")
    put(crm, "policies", {"rows": []}, month="2026-11")  # nothing in it: not listed
    months = crm.client.get(f"{URL}/months", headers=bearer(crm.token(SA))).json()["months"]
    assert list(months) == ["2026-10", "2026-09"]
    assert months["2026-09"] == ["socialBio"]


@pytest.mark.parametrize("sheet,data,message", [
    ("nope", {"rows": []}, "Unknown compliance sheet"),
    ("socialBio", {"weeks": []}, "Unknown section"),
    ("socialBio", {"rows": "x"}, "list of rows"),
    ("socialBio", {"rows": [{"platform": "X"}]}, "needs an id"),
    ("socialBio", {"rows": [{"id": "a"}, {"id": "a"}]}, "repeats the id"),
    ("socialBio", {"rows": [{"id": "a", "bad key": "x"}]}, "not allowed"),
    ("socialBio", {"rows": [{"id": "a", "remarks": "x" * 2001}]}, "at most 2000"),
    ("socialBio", {"rows": [{"id": "a", "nested": {"x": 1}}]}, "text or a number"),
    ("socialBio", {"rows": [{"id": str(i)} for i in range(501)]}, "At most 500"),
])
def test_rejects_bad_shapes(crm_clean, sheet, data, message):
    r = put(crm_clean, sheet, data)
    assert r.status_code in (400, 404)
    assert message in r.json()["detail"]


def test_rejects_bad_month(crm_clean):
    for month in ("2026-13", "26-10", "October"):
        r = put(crm_clean, "socialBio", {"rows": []}, month=month)
        assert r.status_code == 400
        assert get(crm_clean, month=month).status_code == 400


def test_feature_access(crm_clean):
    crm = crm_clean
    # Super Admin by default; an Admin needs the feature switched on in Feature Access
    assert get(crm, who=ADMIN).status_code == 403
    assert put(crm, "socialBio", {"rows": []}, who=ADMIN).status_code == 403
    admin = next(u for u in crm.store.all("users") if u.get("email") == ADMIN)
    crm.store.put("userPermissions", admin["id"], {"id": admin["id"], "value": {"ra-compliance": True}})
    try:
        assert get(crm, who=ADMIN).status_code == 200
        assert put(crm, "socialBio", {"rows": [{"id": "a", "platform": "Instagram"}]}, who=ADMIN).status_code == 200
    finally:
        crm.store.delete("userPermissions", admin["id"])
    # nor can the records be read or written through the generic sync
    r = crm.client.get("/api/sync", params={"collections": "raCompliance", "since": 0}, headers=bearer(crm.token(SA)))
    assert r.status_code == 404


def test_reco_register_from_research_reports(crm_clean):
    crm = crm_clean
    s = crm.store
    s.delete_many("researchReports", [d["id"] for d in s.all("researchReports")])
    base = {"status": "Ready", "test": False, "segment": "NSE DERIVATIVES"}
    s.put("researchReports", "rr-opt", {**base, "id": "rr-opt", "day": "2026-11-05", "callAt": "2026-11-05T04:00:00+00:00",
          "expiry": "27-Nov-2026", "fileName": "05-11-2026 (1) NIFTY 24500 CE.pdf",
          "details": {"symbol": "NIFTY", "instrument": "option", "side": "Buy", "strike": "24500", "optionType": "CE",
                      "entry": "120", "stopLoss": "100", "targets": ["150", "180"]}})
    s.put("researchReports", "rr-eq", {**base, "id": "rr-eq", "day": "2026-11-03", "segment": "NSE BSE EQUITY",
          "details": {"symbol": "RELIANCE", "instrument": "equity", "side": "SELL", "entry": "1400", "stopLoss": "1420", "targets": ["1360"]}})
    s.put("researchReports", "rr-held", {**base, "id": "rr-held", "day": "2026-11-04", "status": "Held"})
    s.put("researchReports", "rr-test", {**base, "id": "rr-test", "day": "2026-11-04", "test": True, "details": {"symbol": "X"}})
    s.put("researchReports", "rr-oct", {**base, "id": "rr-oct", "day": "2026-10-30", "details": {"symbol": "TCS"}})

    r = crm.client.get(f"{URL}/reco-from-reports", params={"month": "2026-11"}, headers=bearer(crm.token(SA)))
    assert r.status_code == 200, r.text
    rows = r.json()["rows"]
    assert [x["reportId"] for x in rows] == ["rr-eq", "rr-opt"]  # oldest first; held, test and other months left out
    eq, opt = rows
    assert opt == {"id": "rep-rr-opt", "reportId": "rr-opt", "date": "2026-11-05", "nature": "Options (NSE DERIVATIVES)",
                   "security": "NIFTY 24500 CE (expiry 27-Nov-2026)", "strike": "24500", "period": "Till expiry (27-Nov-2026)",
                   "callPut": "Call", "buyRate": "120", "sellRate": "150 / 180", "sl": "100", "rationale": "Yes",
                   "reportFile": "05-11-2026 (1) NIFTY 24500 CE.pdf"}
    # a Sell call: sold at the entry, bought back at the target
    assert (eq["sellRate"], eq["buyRate"], eq["sl"], eq["callPut"], eq["strike"]) == ("1400", "1360", "1420", "Put", "1400")

    assert crm.client.get(f"{URL}/reco-from-reports", params={"month": "2026-11"}, headers=bearer(crm.token(ADMIN))).status_code == 403
    s.delete_many("researchReports", ["rr-opt", "rr-eq", "rr-held", "rr-test", "rr-oct"])
