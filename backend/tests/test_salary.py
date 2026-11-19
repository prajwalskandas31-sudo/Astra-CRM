"""Salary Block: closed sales only, sharing splits, and the three Pay Type formulas."""
import pytest

from backend.tests.conftest import bearer

SA, ADMIN = "superadmin@company.com", "admin@company.com"


def user(uid, name, pay_type, **details):
    return {"id": uid, "name": name, "role": "Executive", "status": "Active", "payType": pay_type, "payDetails": details}


def sale(sid, owner, net, day, status="E-Signed & Converted", sharing=None):
    return {"id": sid, "clientName": f"Client {sid}", "submittedByUserId": owner, "netSales": str(net), "status": status,
            "fullClientInfo": {"paymentDate": day, "employeeSharing": sharing or {"present": False}}}


@pytest.fixture
def data(crm):
    s = crm.store
    s.delete_many("sales", [d["id"] for d in s.all("sales")])
    s.delete_many("paidClients", [d["id"] for d in s.all("paidClients")])
    for u in (user("sal-c1", "Comm One", "Commission", commissionPercent=10),
              user("sal-c2", "Comm Two", "Commission", commissionPercent=5),
              user("sal-c3", "Comm NoPct", "Commission"),
              user("sal-s1", "Sal Hit", "Salary", fixedSalary=20000, targetValue=100000),
              user("sal-s2", "Sal Miss", "Salary", fixedSalary=20000, targetValue=100000),
              user("sal-p1", "Plus Hit", "Salary plus Incentives", fixedSalary=25000, targetValue=100000, incentivePercent=10),
              user("sal-p2", "Plus Miss", "Salary plus Incentives", fixedSalary=25000, targetValue=100000, incentivePercent=10)):
        s.put("users", u["id"], u)
    pct_share = {"present": True, "mode": "percentage", "shares": [{"userId": "sal-c2", "value": 25}]}
    fixed_share = {"present": True, "mode": "fixed", "shares": [{"userId": "sal-c2", "value": 1000}]}
    sales = [
        sale("S1", "sal-c1", 100000, "2026-11-05", sharing=pct_share),       # c1 75000, c2 25000
        sale("S2", "sal-c1", 10000, "2026-11-06", status="Old Client - Approved", sharing=fixed_share),  # c1 9000, c2 1000
        sale("S3", "sal-c1", 50000, "2026-11-07", status="Pending Super Admin Approval"),  # not closed
        sale("S4", "sal-c1", 40000, "2026-11-08", status="Approved (eKYC Stage)"),          # closed via Paid block below
        sale("S5", "sal-c1", 99999, "2026-10-31"),                                          # outside the range
        sale("S6", "sal-s1", 100000, "2026-11-10"),                                         # exactly on target
        sale("S7", "sal-s2", 60000, "2026-11-10"),
        sale("S8", "sal-p1", 150000, "2026-11-10"),
        sale("S9", "sal-p2", 90000, "2026-11-10"),
    ]
    for x in sales:
        s.put("sales", x["id"], x)
    s.put("paidClients", "P4", {"id": "P4", "saleId": "S4"})
    return crm


def get(crm, pay_type, who=SA, month="2026-11"):
    return crm.client.get("/api/salary-block", params={"payType": pay_type, "month": month},
                          headers=bearer(crm.token(who)))


def by_id(res):
    assert res.status_code == 200, res.text
    return {r["userId"]: r for r in res.json()["rows"]}


def test_super_admin_only(data):
    assert get(data, "Commission", who=ADMIN).status_code == 403
    assert get(data, "Bonus").status_code == 400
    assert get(data, "Salary", month="2026-13").status_code == 400
    assert get(data, "Salary", month="2026-11-01").status_code == 400


def test_commission_uses_closed_sales_and_sharing(data):
    rows = by_id(get(data, "Commission"))
    assert set(rows) >= {"sal-c1", "sal-c2", "sal-c3"} and "sal-s1" not in rows
    c1 = rows["sal-c1"]
    assert c1["netSales"] == 75000 + 9000 + 40000
    assert c1["totalSalary"] == 12400
    assert {t["saleId"] for t in c1["transactions"]} == {"S1", "S2", "S4"}
    c2 = rows["sal-c2"]
    assert c2["netSales"] == 26000 and c2["totalSalary"] == 1300
    assert all(t["role"] == "Shared" for t in c2["transactions"])
    assert rows["sal-c3"]["status"] == "Pay details missing" and rows["sal-c3"]["totalSalary"] is None


def test_salary_eligibility(data):
    rows = by_id(get(data, "Salary"))
    assert rows["sal-s1"]["status"] == "Eligible for Salary" and rows["sal-s1"]["totalSalary"] == 20000
    miss = rows["sal-s2"]
    assert miss["status"] == "Not Eligible for Salary" and miss["difference"] == 40000 and miss["totalSalary"] is None


def test_salary_plus_incentives(data):
    rows = by_id(get(data, "Salary plus Incentives"))
    hit = rows["sal-p1"]
    assert hit["status"] == "Target Reached" and hit["incentive"] == 5000 and hit["totalSalary"] == 30000
    miss = rows["sal-p2"]
    assert miss["status"] == "Target Not Reached" and miss["totalSalary"] is None and miss["difference"] == 10000


def test_pay_details_saved_per_pay_type(crm):
    h = bearer(crm.token(SA))
    res = crm.client.post("/api/users", headers=h, json={
        "name": "Pay Tester", "email": "pay.tester@company.com", "password": "Strong-Pass-123!", "role": "Executive", "mobile": "9876500011",
        "payType": "Commission", "payDetails": {"commissionPercent": 12.5, "fixedSalary": 9}})
    assert res.status_code in (200, 201), res.text
    uid = res.json()["id"]
    assert crm.store.get("users", uid)["payDetails"] == {"commissionPercent": 12.5}
    res = crm.client.put(f"/api/users/{uid}", headers=h, json={"payType": "Salary", "payDetails": {"fixedSalary": 20000, "targetValue": 100000}})
    assert res.status_code == 200, res.text
    assert crm.store.get("users", uid)["payDetails"] == {"fixedSalary": 20000, "targetValue": 100000}
    bad = crm.client.put(f"/api/users/{uid}", headers=h, json={"payType": "Commission", "payDetails": {"commissionPercent": 150}})
    assert bad.status_code == 400


def test_bad_sharing_values_never_credit_more_than_net_sales(crm):
    sal = crm.main.salary
    over = {"present": True, "mode": "percentage", "shares": [{"userId": "a", "value": 80}, {"userId": "b", "value": 80}]}
    got = dict(sal.credits(sale("X", "p", 1000, "2026-11-01", sharing=over)))
    assert got == {"a": 800, "b": 200, "p": 0}
    negative = {"present": True, "mode": "fixed", "shares": [{"userId": "a", "value": -5000}]}
    got = dict(sal.credits(sale("Y", "p", 1000, "2026-11-01", sharing=negative)))
    assert got == {"a": 0, "p": 1000}


# ---------------------------------------------------------------- monthly payroll

SETTINGS = {"workingDays": 26, "paidLeaves": 1, "absentDeduction": 500, "halfDayDeduction": 250,
            "professionalTax": 200, "professionalTaxLimit": 15000, "insuranceDeduction": 300, "pf": 1800}


@pytest.fixture
def payroll(data):
    s = data.store
    for name in ("salarySettings", "salaryEntries", "attendance"):
        s.delete_many(name, [d["id"] for d in s.all(name)])
    return data


def mark(crm, uid, day, status):
    crm.store.put("attendance", f"{uid}:{day}", {"id": f"{uid}:{day}", "userId": uid, "date": day, "status": status})


def put(crm, path, body, month="2026-11", who=SA):
    return crm.client.put(f"/api/salary-block/{path}", params={"month": month}, json=body, headers=bearer(crm.token(who)))


def test_full_chain_in_order(payroll):
    assert put(payroll, "settings", SETTINGS).status_code == 200
    for day, status in (("01", "Present"), ("02", "Present"), ("03", "Half Day"),
                        ("04", "Leave"), ("05", "Leave"), ("06", "Leave"), ("07", "Absent")):
        mark(payroll, "sal-s1", f"2026-11-{day}", status)
    mark(payroll, "sal-s1", "2026-10-30", "Absent")           # another month: ignored
    res = put(payroll, "entry", {"userId": "sal-s1", "incentive": 1000, "expenses": 500, "deduction": 200,
                                 "advance": 1000, "insurance": True, "pf": False})
    assert res.status_code == 200, res.text
    row = by_id(get(payroll, "Salary"))["sal-s1"]
    a, c = row["attendance"], row["calc"]
    assert (a["worked"], a["workingDays"], a["leave"], a["extraLeave"], a["absentCharged"], a["notMarked"]) == (3, 26, 3, 2, 3, 19)
    assert c["absentDeduction"] == 1500 and c["halfDayDeduction"] == 250
    # 20000 + 1000 - 1500 - 250 + 500 - 200 - 1000 = 18550 > 15000 -> PT 200, then Insurance 300
    assert c["beforeProfessionalTax"] == 18550 and c["professionalTaxStatus"] == "Applicable"
    assert c["professionalTax"] == 200 and c["insurance"] == 300 and c["pf"] == 0
    assert c["finalSalary"] == 18050


def test_below_target_starts_at_zero_and_never_goes_negative(payroll):
    put(payroll, "settings", SETTINGS)
    put(payroll, "entry", {"userId": "sal-s2", "incentive": 2000, "advance": 5000, "pf": True})
    c = by_id(get(payroll, "Salary"))["sal-s2"]["calc"]
    assert c["base"] == 0 and c["professionalTaxStatus"] == "Not Applicable" and c["finalSalary"] == 0


def test_professional_tax_not_applicable_at_the_limit(payroll):
    put(payroll, "settings", {**SETTINGS, "professionalTaxLimit": 20000})
    c = by_id(get(payroll, "Salary"))["sal-s1"]["calc"]
    assert c["beforeProfessionalTax"] == 20000 and c["professionalTaxStatus"] == "Not Applicable"
    assert c["finalSalary"] == 20000


def test_commission_gets_the_same_adjustments(payroll):
    put(payroll, "settings", SETTINGS)
    mark(payroll, "sal-c1", "2026-11-02", "Absent")
    put(payroll, "entry", {"userId": "sal-c1", "incentive": 100, "pf": True})
    c = by_id(get(payroll, "Commission"))["sal-c1"]["calc"]
    # 12400 + 100 - 500 = 12000 (under the PT limit) - PF 1800
    assert c["base"] == 12400 and c["finalSalary"] == 10200


def test_settings_carry_forward_and_entries_are_per_month(payroll):
    put(payroll, "settings", SETTINGS, month="2026-10")
    put(payroll, "entry", {"userId": "sal-s1", "advance": 700}, month="2026-10")
    body = get(payroll, "Salary").json()
    assert body["settings"]["workingDays"] == 26 and body["settings"]["saved"] is False
    assert by_id(get(payroll, "Salary"))["sal-s1"]["entry"]["advance"] == 0
    assert by_id(get(payroll, "Salary", month="2026-10"))["sal-s1"]["entry"]["advance"] == 700


def test_payroll_writes_are_super_admin_only_and_clamped(payroll):
    assert put(payroll, "settings", SETTINGS, who=ADMIN).status_code == 403
    assert put(payroll, "entry", {"userId": "sal-s1"}, who=ADMIN).status_code == 403
    assert put(payroll, "entry", {"userId": "nobody"}).status_code == 404
    assert put(payroll, "settings", SETTINGS, month="2026-1").status_code == 400
    saved = put(payroll, "settings", {"workingDays": 99, "absentDeduction": -5}).json()
    assert saved["workingDays"] == 31 and saved["absentDeduction"] == 0
    assert put(payroll, "entry", {"userId": "sal-s1", "advance": "-10"}).json()["advance"] == 0
