"""Audit Report -> Client and Fee Details: half-year counts, one client across services, typed values."""
from datetime import date

import pytest

from backend.tests.conftest import bearer

SA, ADMIN = "superadmin@company.com", "admin@company.com"
H1 = "2026-27-H1"  # 1 Apr 2026 - 30 Sep 2026


def paid(pid, sale_id, start, end, phone, pan=""):
    return {"id": pid, "saleId": sale_id, "clientName": f"C {pid}", "phone": phone, "panNumber": pan,
            "serviceName": "Equity", "serviceTenure": "3 Months", "serviceStartDate": start, "serviceEndDate": end}


def sale(sid, net, pay_day, category="Individual", status="E-Signed & Converted", **extra):
    return {"id": sid, "clientName": f"S {sid}", "status": status, "netSales": str(net),
            "fullClientInfo": {"paymentDate": pay_day, "clientCategory": category, **extra}}


@pytest.fixture
def data(crm):
    s = crm.store
    for col in ("sales", "paidClients", "eSignRecords", "auditClientFee"):
        s.delete_many(col, [d["id"] for d in s.all(col)])
    sales = [
        sale("A1", 10000, "2026-02-01"),                               # active over 31 Mar, expires 1 May
        sale("A2", 20000, "2026-03-15", category="Non-Individual"),     # active over 31 Mar, expires 15 Jun
        sale("A3", 30000, "2026-05-10"),                               # new in H1
        sale("A4", 40000, "2026-05-12", category="Non-Individual"),     # new in H1
        sale("A5", 5000, "2026-06-01", status="Old Client - Approved", clientType="Old Client",
             phone1="9876500001", serviceTenure="3 Months", serviceEndDate="2026-09-01"),  # A1's renewal (same phone)
        sale("A6", 7000, "2026-10-02"),                                # H2: not in H1
    ]
    for x in sales:
        s.put("sales", x["id"], x)
    for p in (paid("P1", "A1", "2026-02-01", "2026-05-01", "9876500001"),
              paid("P2", "A2", "2026-03-15", "2026-06-15", "9876500002"),
              paid("P3", "A3", "2026-05-10", "2026-08-10", "9876500003"),
              paid("P4", "A4", "2026-05-12", "2026-11-12", "9876500004"),
              paid("P6", "A6", "2026-10-02", "2027-01-02", "9876500006")):
        s.put("paidClients", p["id"], p)
    for sid, day in (("A3", "2026-05-10"), ("A4", "2026-05-12"), ("A6", "2026-10-02")):
        s.put("eSignRecords", f"E{sid}", {"id": f"E{sid}", "saleId": sid, "confirmedAt": day})
    return crm


def get(crm, period=H1, who=SA):
    return crm.client.get("/api/audit-reports/client-fee", params={"period": period}, headers=bearer(crm.token(who)))


def rows(res):
    assert res.status_code == 200, res.text
    return {r["key"]: r for r in res.json()["rows"]}


def test_access_and_period(data):
    assert get(data, who=ADMIN).status_code == 403
    assert get(data, period="2026-28-H1").status_code == 400
    assert get(data, period="2026-27-H3").status_code == 400
    assert get(data, period="2026-27-H2").json()["from"] == "2026-10-01"


def test_counts(data, monkeypatch):
    import backend.audit_report as ar
    real = ar.computed
    monkeypatch.setattr(ar, "computed", lambda period, today=None: real(period, today=date(2026, 11, 20)))
    r = rows(get(data))
    assert (r["r1"]["cells"]["A"], r["r1"]["cells"]["D"], r["r1"]["total"]) == (1, 1, 2)
    assert (r["r2"]["cells"]["A"], r["r2"]["cells"]["D"]) == (1, 1)
    # Expired in H1: A2 (15 Jun), A3 (10 Aug) and A1's renewal (1 Sep; one client, its last expiry); P4 runs to Nov
    assert (r["r3"]["cells"]["A"], r["r3"]["cells"]["D"]) == (2, 1)
    assert r["r4"]["cells"]["A"] == 1 + 1 - 2 and r["r4"]["cells"]["D"] == 1 + 1 - 1
    # 12-31 May: A2, A3, A4 (P1 ended 1 May); from 1 Jun A1's renewal joins -> 4, first reached on 1 Jun
    assert r["r5"]["value"] == 4 and r["r5"]["day"] == "2026-06-01"
    assert r["r8"]["cells"]["A"] == 30000 + 5000 and r["r8"]["cells"]["D"] == 40000 and r["r8"]["total"] == 75000
    assert all(r[k]["cells"][c] == 0 for k in ("r1", "r2", "r3", "r8") for c in "BCEF")


def test_typed_values_override_and_reset(data):
    h = bearer(data.token(SA))
    res = data.client.put("/api/audit-reports/client-fee", params={"period": H1},
                          json={"values": {"r1.B": 3, "r6": "FD with XYZ Bank", "r7": 100000, "bogus": 1}}, headers=h)
    r = rows(res)
    assert r["r1"]["cells"]["B"] == 3 and "B" in r["r1"]["edited"] and r["r1"]["total"] == 5
    assert r["r4"]["cells"]["B"] == 3
    assert r["r6"]["value"] == "FD with XYZ Bank" and r["r7"]["value"] == 100000
    r = rows(data.client.put("/api/audit-reports/client-fee", params={"period": H1}, json={"values": {}}, headers=h))
    assert r["r1"]["cells"]["B"] == 0 and r["r6"]["value"] == ""
    assert data.client.put("/api/audit-reports/client-fee", params={"period": H1}, json={"values": {"r7": -1}}, headers=h).status_code == 400


def test_pdf(data):
    h = bearer(data.token(SA))
    for params in ({"period": H1}, {"period": H1, "rows": "r8"}, {"period": H1, "rows": "r1,r2"}):
        r = data.client.get("/api/audit-reports/client-fee/pdf", params=params, headers=h)
        assert r.status_code == 200 and r.content.startswith(b"%PDF"), r.text
