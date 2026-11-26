"""Pay Slip Block: figures from the Salary Block, employee details, words, access and the PDF."""
import pytest

from backend import payslip
from backend.tests.conftest import bearer

SA, ADMIN = "superadmin@company.com", "admin@company.com"
MONTH = "2026-06"


@pytest.fixture
def data(crm):
    s = crm.store
    for col in ("sales", "paidClients", "salarySettings", "salaryEntries", "attendance"):
        s.delete_many(col, [d["id"] for d in s.all(col)])
    s.put("companyProfile", "brandName", {"id": "brandName", "value": "InvestEQ"})
    s.put("companyProfile", "companyName", {"id": "companyName", "value": "Unite Technologies Financial Service"})
    s.put("companyProfile", "registeredAddress", {"id": "registeredAddress", "value": "No: 9, Kuvempu Nagar, BTM Layout"})
    s.put("users", "ps-u1", {"id": "ps-u1", "name": "Shaik Yasmin", "employeeId": "UNITEB19", "role": "Executive",
                             "status": "Active", "payType": "Commission", "payDetails": {"commissionPercent": 10},
                             "uanNumber": "100200300400", "bankAccountNumber": "91234567890123", "ifscCode": "HDFC0000456",
                             "dateOfJoining": "2025-04-01", "dateOfBirth": "1998-02-14", "panNumber": "ABCDE1234F",
                             "aadhaarNumber": "234567890123"})
    s.put("users", "ps-u2", {"id": "ps-u2", "name": "No Pay Type", "employeeId": "E2", "role": "Executive", "status": "Active"})
    s.put("sales", "PS1", {"id": "PS1", "clientName": "Ravi", "status": "E-Signed & Converted", "submittedByUserId": "ps-u1",
                           "netSales": "400000", "fullClientInfo": {"paymentDate": "2026-06-10"}})
    # 1 absent x 500, 1 half day x 250, advance 1000, expenses 2000, incentive 1500, PT 200 (limit 0), PF 1800
    s.put("salarySettings", MONTH, {"id": MONTH, "workingDays": 26, "paidLeaves": 0, "absentDeduction": 500,
                                    "halfDayDeduction": 250, "professionalTax": 200, "professionalTaxLimit": 0,
                                    "insuranceDeduction": 600, "pf": 1800})
    s.put("salaryEntries", f"{MONTH}:ps-u1", {"id": f"{MONTH}:ps-u1", "userId": "ps-u1", "month": MONTH, "incentive": 1500,
                                              "expenses": 2000, "advance": 1000, "pf": True})
    s.put("attendance", "ps-u1:2026-06-03", {"id": "ps-u1:2026-06-03", "userId": "ps-u1", "date": "2026-06-03", "status": "Absent"})
    s.put("attendance", "ps-u1:2026-06-04", {"id": "ps-u1:2026-06-04", "userId": "ps-u1", "date": "2026-06-04", "status": "Half Day"})
    return crm


def get(crm, path="", who=SA, **params):
    params = {"userId": "ps-u1", "month": MONTH, **params}
    return crm.client.get(f"/api/payslip{path}", params=params, headers=bearer(crm.token(who)))


def test_figures_match_the_salary_block(data):
    res = get(data)
    assert res.status_code == 200, res.text
    p = res.json()
    assert p["company"]["title"] == "InvestEQ by Unite Technologies Financial Service"
    assert p["monthName"] == "June 2026" and p["payDate"] == "2026-07-01" and p["payDateText"] == "01/07/2026"
    earn = {e["label"]: e for e in p["earnings"]}
    assert earn["Net Sales"]["amount"] == 400000 and earn["Net Sales"]["reference"]
    assert earn["Commission %"]["text"] == "10%"
    assert earn["Total Salary"]["amount"] == 40000 and earn["Incentive"]["amount"] == 1500 and earn["Expenses"]["amount"] == 2000
    assert p["grossEarnings"] == 43500
    ded = {d["label"]: d["amount"] for d in p["deductions"]}
    assert ded == {"Provident Fund (PF)": 1800, "Professional Tax": 200, "Insurance": 0, "Absent (1 day)": 500,
                   "Half Day (1)": 250, "Advance": 1000}
    assert p["totalDeductions"] == 3750
    # Net = Gross - Deductions = the Salary Block's Final Total Salary
    final = next(r for r in data.client.get("/api/salary-block", params={"payType": "Commission", "month": MONTH},
                                             headers=bearer(data.token(SA))).json()["rows"] if r["userId"] == "ps-u1")
    assert p["netPay"] == 39750 == final["calc"]["finalSalary"]
    assert p["amountInWords"] == "Indian Rupee Thirty-Nine Thousand Seven Hundred Fifty Only"
    # LOP = 1 absent + half of 1 half day; Paid = 26 - 1.5
    assert p["attendance"] == {"workingDays": 26, "paidDays": "24.5", "lopDays": "1.5"}


def test_employee_summary(data):
    e = get(data, payDate="2026-07-05").json()
    assert e["payDateText"] == "05/07/2026"
    emp = e["employee"]
    assert emp["aadhaarMasked"] == "XXXX XXXX 0123" and emp["uanNumber"] == "100200300400"
    assert emp["dateOfJoining"] == "01/04/2025" and emp["dateOfBirth"] == "14/02/1998" and emp["payType"] == "Commission"


def test_errors_and_access(data):
    assert get(data, who=ADMIN).status_code == 403
    assert get(data, path="/employees", who=ADMIN).status_code == 403
    assert get(data, userId="ps-u2").status_code == 400  # no Pay Type
    assert get(data, userId="nobody").status_code == 404
    assert get(data, month="2026-13").status_code == 400
    assert get(data, payDate="2026-02-30").status_code == 400
    # Feature Access can grant it to another role
    admin = next(u for u in data.store.all("users") if u.get("email") == ADMIN)
    data.store.put("userPermissions", admin["id"], {"id": admin["id"], "value": {"payslip-block": True}})
    assert get(data, who=ADMIN).status_code == 200


def test_employee_list(data):
    res = get(data, path="/employees")
    names = {e["name"]: e for e in res.json()["employees"]}
    assert names["Shaik Yasmin"]["employeeId"] == "UNITEB19" and names["No Pay Type"]["payType"] == ""


def test_pdf(data):
    res = get(data, path="/pdf")
    assert res.status_code == 200 and res.content.startswith(b"%PDF")
    assert 'filename="Payslip_UNITEB19_Jun_2026.pdf"' in res.headers["content-disposition"]


@pytest.mark.parametrize("amount,words", [
    (0, "Indian Rupee Zero Only"),
    (35789, "Indian Rupee Thirty-Five Thousand Seven Hundred Eighty-Nine Only"),
    (1234567.5, "Indian Rupee Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paise Only"),
    (120000000, "Indian Rupee Twelve Crore Only"),
    (100, "Indian Rupee One Hundred Only"),
])
def test_amount_in_words(amount, words):
    assert payslip.amount_in_words(amount) == words


def test_title_without_brand():
    assert payslip.company_title({"brandName": "", "companyName": "Unite"}) == "Unite"
    assert payslip.company_title({"brandName": "Unite", "companyName": "Unite"}) == "Unite"
    assert payslip.default_pay_date("2026-12") == "2027-01-01"
