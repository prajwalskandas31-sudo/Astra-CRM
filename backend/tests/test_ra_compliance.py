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
