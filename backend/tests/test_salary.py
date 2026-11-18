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


def get(crm, pay_type, who=SA, frm="2026-11-01", to="2026-11-30"):
    return crm.client.get("/api/salary-block", params={"payType": pay_type, "from": frm, "to": to},
                          headers=bearer(crm.token(who)))


def by_id(res):
    assert res.status_code == 200, res.text
    return {r["userId"]: r for r in res.json()["rows"]}


def test_super_admin_only(data):
    assert get(data, "Commission", who=ADMIN).status_code == 403
    assert get(data, "Bonus").status_code == 400
    assert get(data, "Salary", frm="2026-12-01", to="2026-11-01").status_code == 400


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
