"""Running Account Statement: client credits, payroll lines (cash-correct Salary Paid), manual entries, adjustments."""
import pytest

from backend.tests.conftest import bearer

SA, ADMIN = "superadmin@company.com", "admin@company.com"
MONTH = "2026-10"


@pytest.fixture
def data(crm):
    s = crm.store
    for col in ("sales", "paidClients", "ledgerManualEntries", "ledgerAdjustments", "salarySettings", "salaryEntries", "attendance"):
        s.delete_many(col, [d["id"] for d in s.all(col)])
    s.put("users", "ra-u1", {"id": "ra-u1", "name": "Asha", "employeeId": "EMP9", "role": "Executive", "status": "Active",
                             "payType": "Salary", "payDetails": {"fixedSalary": 30000, "targetValue": 0}})
    s.put("sales", "RA1", {"id": "RA1", "clientName": "Ravi", "status": "E-Signed & Converted", "submittedByUserId": "ra-u1",
                           "netSales": "50000", "fullClientInfo": {"paymentDate": "2026-10-05", "serviceName": "Equity Cash",
                                                                   "paymentModes": [{"mode": "UPI", "amount": 30000}, {"mode": "NEFT", "amount": 29000}]}})
    s.put("sales", "RA2", {"id": "RA2", "clientName": "Meena", "status": "E-Signed & Converted", "netSales": "10000",
                           "fullClientInfo": {"paymentDate": "2026-10-20", "serviceName": "F&O", "paymentModes": [{"mode": "Cash", "amount": 11800}]}})
    s.put("sales", "RA3", {"id": "RA3", "clientName": "Pending", "status": "Pending Super Admin Approval", "netSales": "99999",
                           "fullClientInfo": {"paymentDate": "2026-10-21"}})
    # Payroll: 2 absent x 500, advance 5000, expenses 2000, PT 200 (limit 0) -> Final 25,800
    s.put("salarySettings", MONTH, {"id": MONTH, "workingDays": 26, "paidLeaves": 0, "absentDeduction": 500,
                                    "halfDayDeduction": 0, "professionalTax": 200, "professionalTaxLimit": 0, "insuranceDeduction": 0, "pf": 0})
    s.put("salaryEntries", f"{MONTH}:ra-u1", {"id": f"{MONTH}:ra-u1", "userId": "ra-u1", "month": MONTH, "advance": 5000, "expenses": 2000})
    for d in ("2026-10-06", "2026-10-07"):
        s.put("attendance", f"ra-u1:{d}", {"id": f"ra-u1:{d}", "userId": "ra-u1", "date": d, "status": "Absent"})
    return crm


def get(crm, month=MONTH, who=SA):
    return crm.client.get("/api/running-account", params={"month": month}, headers=bearer(crm.token(who)))


def by_kind(res):
    assert res.status_code == 200, res.text
    out = {}
    for e in res.json()["entries"]:
        out.setdefault(e["kind"], []).append(e)
    return out


def test_access(data):
    assert get(data, who=ADMIN).status_code == 403
    assert get(data, month="2026-13").status_code == 400


def test_client_payments_and_narration(data):
    k = by_kind(get(data))
    pays = {e["saleId"]: e for e in k["clientPayment"]}
    assert set(pays) == {"RA1", "RA2"}  # not the pending sale
    assert pays["RA1"]["credit"] == 50000 and pays["RA1"]["entryDate"] == "2026-10-05"
    assert pays["RA1"]["narration"] == ("Payment received from Ravi via Multiple Payment of UPI (₹30,000.00) + "
                                        "NEFT (₹29,000.00) for Equity Cash")
    assert pays["RA2"]["narration"] == "Payment received from Meena via Cash for F&O"


def test_payroll_is_cash_correct(data):
    res = get(data)
    k = by_kind(res)
    assert k["advance"][0]["debit"] == 5000 and k["advance"][0]["narration"] == "Advance of ₹5,000.00 taken by Asha (EMP9)"
    assert k["expenses"][0]["debit"] == 2000
    assert k["absentDeduction"][0]["credit"] == 1000
    assert k["salaryPaid"][0]["debit"] == 25000          # 30,000 base - 5,000 advance recovered
    assert k["professionalTax"][0]["neutral"] == 200 and k["professionalTax"][0]["debit"] == 0
    payroll = sum(e["credit"] - e["debit"] for e in res.json()["entries"] if e.get("userId"))
    assert payroll == -31000                              # 30,800 paid out + 200 PT withheld
    t = res.json()["totals"]
    assert t["credit"] == 61000 and t["debit"] == 32000 and t["net"] == 29000
    assert res.json()["entries"][-1]["balance"] == 29000
    assert all(e["entryDate"] == "2026-10-31" for e in res.json()["entries"] if e.get("userId"))


def test_adjust_date_moves_entry_and_debit(data):
    h = bearer(data.token(SA))
    r = data.client.put("/api/running-account/adjust", json={"key": "sale:RA2", "adjustedDate": "2026-11-02", "debit": 500}, headers=h)
    assert r.status_code == 200, r.text
    assert "RA2" not in {e["saleId"] for e in by_kind(get(data))["clientPayment"]}
    moved = by_kind(get(data, "2026-11"))["clientPayment"]
    assert [(e["saleId"], e["debit"], e["adjusted"]) for e in moved] == [("RA2", 500, True)]
    # Payroll line moved into November still shows there
    data.client.put("/api/running-account/adjust", json={"key": "pay:2026-10:ra-u1:advance", "adjustedDate": "2026-11-01"}, headers=h)
    assert by_kind(get(data, "2026-11"))["advance"][0]["debit"] == 5000
    assert "advance" not in by_kind(get(data))
    # Clearing it puts it back
    data.client.put("/api/running-account/adjust", json={"key": "pay:2026-10:ra-u1:advance", "adjustedDate": ""}, headers=h)
    assert "advance" in by_kind(get(data))
    assert data.client.put("/api/running-account/adjust", json={"key": "bogus"}, headers=h).status_code == 400


def test_manual_entries(data):
    h = bearer(data.token(SA))
    bad = data.client.post("/api/running-account/manual", json={"adjustedDate": "2026-10-10", "narration": "x", "type": "Gift", "amount": 1}, headers=h)
    assert bad.status_code == 400
    r = data.client.post("/api/running-account/manual", json={"adjustedDate": "2026-10-10", "narration": "Office rent", "type": "Debit", "amount": 12000}, headers=h)
    assert r.status_code == 200, r.text
    mid = r.json()["id"]
    assert by_kind(get(data))["manual"][0]["debit"] == 12000
    data.client.put(f"/api/running-account/manual/{mid}", json={"adjustedDate": "2026-10-10", "narration": "Refund", "type": "Credit", "amount": 300}, headers=h)
    m = by_kind(get(data))["manual"][0]
    assert m["credit"] == 300 and m["debit"] == 0 and m["narration"] == "Refund"
    assert data.client.delete(f"/api/running-account/manual/{mid}", headers=h).status_code == 200
    assert "manual" not in by_kind(get(data))


def test_pdf(data):
    h = bearer(data.token(SA))
    r = data.client.get("/api/running-account/pdf", params={"month": MONTH}, headers=h)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    r = data.client.get("/api/running-account/pdf", params={"month": MONTH, "section": "advanceExpense"}, headers=h)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
