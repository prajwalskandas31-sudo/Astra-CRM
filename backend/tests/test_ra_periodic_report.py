"""RA Periodic Report Block: access, values filled from the CRM, saving per half, copying a previous half."""
import pytest

from backend.tests.conftest import bearer

SA, ADMIN = "superadmin@company.com", "admin@company.com"
H2 = "2025-26-H2"  # half year ended 31 Mar 2026
URL = "/api/ra-periodic-report"


@pytest.fixture
def crm_data(crm):
    s = crm.store
    for col in ("raPeriodicReport", "branches", "researchReports", "sales", "paidClients", "eSignRecords", "auditClientFee"):
        s.delete_many(col, [d["id"] for d in s.all(col)])
    for key, value in {
        "companyName": "UNITE TECHNOLOGIES FINANCIAL SERVICE", "sebiRegistrationNumber": "inh000020350",
        "gstin": "24AAIFU6012A1Z5", "website": "https://investeq.in/", "companyLogo": "data:image/png;base64,AA==",
        "registeredAddress": "Shop No 219 Sai Vittorio, Althan Canal Road, Surat 395017", "state": "Gujarat",
        "contact": "7984971743", "email": "support@investeq.in",
        "bankAccounts": [{"id": "b1", "bankName": "AXIS BANK LTD", "accountNumber": "924020066659487", "ifscCode": "utib0000047",
                          "accountType": "Current", "bankBranch": "SURAT MAIN ROAD", "upiId": "unite.ra@validaxis"},
                         {"id": "b2", "bankName": "", "accountNumber": "", "upiId": ""}],
    }.items():
        s.put("companyProfile", key, {"id": key, "value": value})
    s.put("branches", "br1", {"id": "br1", "name": "Bengaluru", "address": "122/3, First Floor\nBommanahalli, Bengaluru 560068"})
    for rid, day, status, test in (("r1", "2026-01-05T04:00:00Z", "Ready", False), ("r2", "2026-03-31T10:00:00Z", "Ready", False),
                                   ("r3", "2026-02-01T04:00:00Z", "Held", False), ("r4", "2026-02-01T04:00:00Z", "Ready", True),
                                   ("r5", "2026-04-01T04:00:00Z", "Ready", False)):
        s.put("researchReports", rid, {"id": rid, "status": status, "test": test, "createdAt": day})
    s.put("sales", "S1", {"id": "S1", "clientName": "A", "status": "E-Signed & Converted", "netSales": "1000",
                          "fullClientInfo": {"paymentDate": "2026-01-10", "clientCategory": "Non-Individual"}})
    return crm


def get(crm, period=H2, who=SA):
    return crm.client.get(URL, params={"period": period}, headers=bearer(crm.token(who)))


def put(crm, data, period=H2, who=SA):
    return crm.client.put(URL, params={"period": period}, json={"data": data}, headers=bearer(crm.token(who)))


def test_access_and_period(crm_data):
    assert get(crm_data, who=ADMIN).status_code == 403
    assert put(crm_data, {}, who=ADMIN).status_code == 403
    assert get(crm_data, period="2025-27-H2").status_code == 400
    res = get(crm_data)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["from"] == "2025-10-01" and body["to"] == "2026-03-31"
    assert body["saved"] == {} and body["previous"] is None


def test_auto_values_from_crm(crm_data):
    auto = get(crm_data).json()["auto"]
    g = auto["general"]
    assert g["registeredName"] == "UNITE TECHNOLOGIES FINANCIAL SERVICE"
    assert g["sebiRegNo"] == "INH000020350"
    assert g["pan"] == "AAIFU6012A"          # from the GSTIN
    assert g["logo"] == "Yes" and g["upiApplied"] == "Yes"
    assert g["researchReports"] == "3"        # Ready (test ones too) inside the half; Held and outside not counted
    assert g["reg.state"] == "Gujarat" and g["reg.pincode"] == "395017" and g["corr.pincode"] == "395017"
    assert auto["branches"][0]["pincode"] == "560068" and auto["branches"][0]["line1"] == "122/3, First Floor"
    assert auto["websites"] == [{"url": "https://investeq.in/"}]
    assert auto["banks"] == [{"holderName": "UNITE TECHNOLOGIES FINANCIAL SERVICE", "accountNo": "924020066659487",
                              "accountType": "CURRENT", "ifsc": "UTIB0000047", "bankName": "AXIS BANK LTD", "branch": "SURAT MAIN ROAD"}]
    assert auto["upi"] == [{"upiId": "unite.ra@validaxis"}]
    assert auto["clientsFees"]["r8.D"] == 1000  # Non-Individual fees from the Audit Report
    assert auto["social"] == [] and auto["directors"] == []


def test_save_keeps_values_per_half_and_offers_copy(crm_data):
    data = {"general": {"legalStructure": "Partnership", "reg.city": "Surat", "raCount": 1},
            "complaints": {"q2.scores": "1", "q2.other": ""},
            "directors": [{"name": "NISHANT AGARWAL", "pan": "DQSPA4342C", "dob": "2000-04-21"}],
            "branches": []}
    res = put(crm_data, data)
    assert res.status_code == 200, res.text
    saved = res.json()["saved"]
    assert saved["general"] == {"legalStructure": "Partnership", "reg.city": "Surat", "raCount": "1"}
    assert saved["branches"] == [] and "websites" not in saved  # an emptied list stays empty; untouched lists use the CRM
    assert res.json()["updatedBy"]

    other = get(crm_data, period="2026-27-H1").json()
    assert other["saved"] == {}
    assert other["previous"]["period"] == H2 and other["previous"]["data"]["directors"][0]["name"] == "NISHANT AGARWAL"


@pytest.mark.parametrize("bad", [
    "nope",
    {"general": {"bad key!": "x"}},
    {"general": {"a": {"nested": 1}}},
    {"directors": "x"},
    {"directors": [["x"]]},
    {"nism": [{"name": "x"}] * 201},
    {"general": {f"k{i}": "x" for i in range(201)}},
])
def test_rejects_bad_shapes(crm_data, bad):
    assert put(crm_data, bad).status_code == 400


def test_long_text_is_trimmed(crm_data):
    res = put(crm_data, {"general": {"others": "x" * 5000}})
    assert res.status_code == 200 and len(res.json()["saved"]["general"]["others"]) == 1000


def test_point_38_counts_active_graduates(crm_data):
    s = crm_data.store
    users = s.all("users")
    # The Super Admin (who calls the API) is a Graduate; one other user is a Graduate too
    sa = next(u for u in users if u.get("email") == SA)
    other = next(u for u in users if u["id"] != sa["id"])
    try:
        for u in users:
            grad = u["id"] in (sa["id"], other["id"])
            s.put("users", u["id"], {**u, "education": "Graduate" if grad else "Non-Graduate", "status": "Active"})
        assert get(crm_data).json()["auto"]["general"]["employees"] == "2"
        s.put("users", other["id"], {**s.get("users", other["id"]), "status": "Inactive"})
        assert get(crm_data).json()["auto"]["general"]["employees"] == "1"
    finally:
        for u in users:
            s.put("users", u["id"], u)
