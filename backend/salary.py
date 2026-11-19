"""Salary Block (Super Admin only): what each employee earns for a date range, by their Pay Type.

Net Sales come from closed client transactions only: a sale whose client reached the Paid block
(E-Signed & Converted, or an Old Client approved in Telegram). A sale counts in the range by the
Payment Date on its Client Information page.

Each sale's Net Sales are credited to the employees on it: when Sharing Present is on, every
selected employee gets their share (fixed ₹, or % of Net Sales) and the primary employee (who
submitted the sale) gets what is left; otherwise the primary employee gets all of it.

Pay figures come from the Add User page (user["payDetails"], see PAY_DETAIL_FIELDS in main.py):
  Commission              total = Net Sales x Commission %
  Salary                  Eligible for Salary when Net Sales reach the Target, else the shortfall
  Salary plus Incentives  when Net Sales reach the Target: Fixed Salary + (Net Sales - Target) x Incentive %,
                          else "Target Not Reached"

Payroll is worked out per month. Each month keeps its own global settings (salarySettings, id "YYYY-MM":
working days, paid leaves, ₹ per Absent day / Half Day, Professional Tax value and limit, Insurance, PF)
and each employee's entries (salaryEntries, id "YYYY-MM:userId": Incentive, Expenses, Deduction,
Advance, Insurance on/off, PF on/off). A month without settings starts from the latest earlier month's.

Final Total Salary, in this order (see payroll()):
  base (Total Salary above; ₹0 when there is none, e.g. target not reached)
  + Incentive
  - Absent days x ₹ per Absent day   (leaves beyond the paid allowance count as Absent; unmarked days cost nothing)
  - Half Days x ₹ per Half Day
  + Expenses - Deduction - Advance
  - Professional Tax, only when the amount so far is greater than the Professional Tax Limit ("Applicable")
  - Insurance (if on for the employee) - PF (if on)
  never below ₹0.
"""
import re
from collections import Counter, defaultdict
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

try:
    from backend import store
    from backend.auth import get_current_user
except ImportError:
    import store
    from auth import get_current_user

router = APIRouter(prefix="/api/salary-block", tags=["salary"])

COMMISSION, SALARY, SALARY_PLUS = "Commission", "Salary", "Salary plus Incentives"
PAY_TYPES = (COMMISSION, SALARY, SALARY_PLUS)

# Sale statuses that mean the client is closed (in the Paid block)
CLOSED_STATUSES = {"E-Signed & Converted", "Old Client - Approved"}

ELIGIBLE, NOT_ELIGIBLE = "Eligible for Salary", "Not Eligible for Salary"
TARGET_REACHED, TARGET_NOT_REACHED = "Target Reached", "Target Not Reached"
MISSING = "Pay details missing"

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")

SETTINGS, ENTRIES = "salarySettings", "salaryEntries"   # server-only collections (not in sync POLICIES)
# Global settings for a month: field -> largest value allowed
SETTING_FIELDS = {
    "workingDays": 31, "paidLeaves": 31, "absentDeduction": 10_000_000, "halfDayDeduction": 10_000_000,
    "professionalTax": 10_000_000, "professionalTaxLimit": 1_000_000_000,
    "insuranceDeduction": 10_000_000, "pf": 10_000_000,
}
ENTRY_AMOUNTS = ("incentive", "expenses", "deduction", "advance")
ENTRY_SWITCHES = ("insurance", "pf")
MAX_AMOUNT = 1_000_000_000
APPLICABLE, NOT_APPLICABLE = "Applicable", "Not Applicable"


def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "Super Admin":
        raise HTTPException(status_code=403, detail="Only the Super Admin can open the Salary Block.")
    return current_user


def _num(value) -> float:
    try:
        n = float(str(value).replace(",", "").replace("₹", "").strip())
    except (TypeError, ValueError):
        return 0.0
    return n if n == n else 0.0


def _figure(details: dict, key: str) -> Optional[float]:
    value = (details or {}).get(key)
    if value is None or str(value).strip() == "":
        return None
    return _num(value)


def _r2(n: float) -> float:
    return round(n + 0.0, 2)


def _info(sale: dict) -> dict:
    return sale.get("fullClientInfo") or sale.get("clientInfo") or {}


def payment_date(sale: dict) -> str:
    return str(_info(sale).get("paymentDate") or sale.get("paymentDate") or sale.get("date") or "")[:10]


def closed_sales(paid_sale_ids: set) -> list:
    return [s for s in store.all("sales")
            if s.get("status") in CLOSED_STATUSES or s.get("id") in paid_sale_ids]


def credits(sale: dict) -> list:
    """[(userId, amount credited)] for one sale's Net Sales: sharers first, the primary employee gets the rest."""
    info = _info(sale)
    net = _num(sale.get("netSales") if sale.get("netSales") not in (None, "") else info.get("netSales"))
    primary = sale.get("submittedByUserId") or sale.get("employeeId")
    sharing = sale.get("employeeSharing") or info.get("employeeSharing") or {}
    net = max(net, 0.0)
    out = []
    left = net
    if isinstance(sharing, dict) and sharing.get("present"):
        pct = sharing.get("mode") == "percentage"
        for share in (sharing.get("shares") or [])[:5]:
            if not isinstance(share, dict) or not share.get("userId"):
                continue
            value = max(_num(share.get("value")), 0.0)
            # Never negative, and all shares together never more than the sale's Net Sales
            amount = min(net * min(value, 100.0) / 100 if pct else value, left)
            left -= amount
            out.append((share["userId"], amount))
    if primary:
        out.append((primary, left))
    return out


def compute(pay_type: str, date_from: str, date_to: str) -> dict:
    paid_sale_ids = {p.get("saleId") for p in store.all("paidClients") if p.get("saleId")}
    net_by_user = defaultdict(float)
    lines_by_user = defaultdict(list)
    for sale in closed_sales(paid_sale_ids):
        day = payment_date(sale)
        if not (date_from <= day <= date_to):
            continue
        primary = sale.get("submittedByUserId") or sale.get("employeeId")
        for user_id, amount in credits(sale):
            net_by_user[user_id] += amount
            lines_by_user[user_id].append({
                "saleId": sale.get("id"), "clientName": sale.get("clientName") or _info(sale).get("clientName") or "",
                "paymentDate": day, "credited": _r2(amount), "role": "Primary" if user_id == primary else "Shared",
            })

    branches = {b.get("id"): b.get("name", "") for b in store.all("branches")}
    rows = []
    for user in store.all("users"):
        if user.get("payType") != pay_type:
            continue
        details = user.get("payDetails") or {}
        net = _r2(net_by_user.get(user["id"], 0.0))
        row = {
            "userId": user["id"], "name": user.get("name", ""), "employeeId": user.get("employeeId", ""),
            "role": user.get("role", ""), "branch": branches.get(user.get("branchId"), ""),
            "userStatus": user.get("status") or "Active",
            "netSales": net, "transactions": sorted(lines_by_user.get(user["id"], []), key=lambda l: l["paymentDate"]),
        }
        if pay_type == COMMISSION:
            pct = _figure(details, "commissionPercent")
            row.update(commissionPercent=pct,
                       totalSalary=None if pct is None else _r2(net * pct / 100),
                       status=MISSING if pct is None else "")
        else:
            target, fixed = _figure(details, "targetValue"), _figure(details, "fixedSalary")
            row.update(targetValue=target, fixedSalary=fixed)
            reached = target is not None and net >= target
            row["difference"] = None if target is None else _r2(abs(net - target))
            if pay_type == SALARY:
                row["status"] = MISSING if target is None else (ELIGIBLE if reached else NOT_ELIGIBLE)
                row["totalSalary"] = fixed if reached else None
            else:
                pct = _figure(details, "incentivePercent")
                row["incentivePercent"] = pct
                if target is None or fixed is None or pct is None:
                    row.update(status=MISSING, incentive=None, totalSalary=None)
                elif reached:
                    incentive = _r2((net - target) * pct / 100)
                    row.update(status=TARGET_REACHED, incentive=incentive, totalSalary=_r2(fixed + incentive))
                else:
                    row.update(status=TARGET_NOT_REACHED, incentive=None, totalSalary=None)
        rows.append(row)
    rows.sort(key=lambda r: (-r["netSales"], r["name"].lower()))
    return {"payType": pay_type, "from": date_from, "to": date_to, "rows": rows}


# ---------------------------------------------------------------- monthly payroll

def month_range(month: str) -> tuple:
    m = MONTH.match(month or "")
    if not m:
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM.")
    year, mon = int(m.group(1)), int(m.group(2))
    days = [31, 29 if (year % 4 == 0 and year % 100 != 0) or year % 400 == 0 else 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mon - 1]
    return f"{month}-01", f"{month}-{days:02d}"


def _clean_settings(raw: Optional[dict]) -> dict:
    return {k: max(0.0, min(_num((raw or {}).get(k)), cap)) for k, cap in SETTING_FIELDS.items()}


def settings_for(month: str) -> dict:
    """This month's saved settings, else the latest earlier month's (so they carry forward), else zeros."""
    saved = store.get(SETTINGS, month)
    if saved is None:
        earlier = sorted((d for d in store.all(SETTINGS) if str(d.get("id", "")) < month), key=lambda d: d["id"])
        saved = earlier[-1] if earlier else {}
    out = _clean_settings(saved)
    out["saved"] = store.get(SETTINGS, month) is not None
    return out


def _clean_entry(raw: Optional[dict]) -> dict:
    raw = raw or {}
    out = {k: max(0.0, min(_num(raw.get(k)), MAX_AMOUNT)) for k in ENTRY_AMOUNTS}
    out.update({k: bool(raw.get(k)) for k in ENTRY_SWITCHES})
    return out


def attendance_counts(month: str, user_ids: set) -> dict:
    counts = defaultdict(Counter)
    for rec in store.all("attendance"):
        uid = rec.get("userId")
        if uid in user_ids and str(rec.get("date", "")).startswith(month + "-"):
            counts[uid][rec.get("status")] += 1
    return counts


def payroll(base: Optional[float], marked: Counter, settings: dict, entry: dict) -> tuple:
    """(attendance breakdown, step-by-step calculation) for one employee. See the module docstring."""
    present, half, leave, absent = (marked.get(s, 0) for s in ("Present", "Half Day", "Leave", "Absent"))
    paid_leaves = int(settings["paidLeaves"])
    extra_leave = max(0, leave - paid_leaves)
    absent_days = absent + extra_leave
    working = int(settings["workingDays"])
    attendance = {
        "workingDays": working, "worked": present + half, "present": present, "halfDay": half,
        "leave": leave, "paidLeave": min(leave, paid_leaves), "extraLeave": extra_leave, "absent": absent,
        "absentCharged": absent_days, "notMarked": max(0, working - (present + half + leave + absent)),
    }
    c = {"base": _r2(base or 0.0), "incentive": entry["incentive"]}
    c["absentDeduction"] = _r2(absent_days * settings["absentDeduction"])
    c["halfDayDeduction"] = _r2(half * settings["halfDayDeduction"])
    c["expenses"], c["deduction"], c["advance"] = entry["expenses"], entry["deduction"], entry["advance"]
    amount = (c["base"] + c["incentive"] - c["absentDeduction"] - c["halfDayDeduction"]
              + c["expenses"] - c["deduction"] - c["advance"])
    c["beforeProfessionalTax"] = _r2(amount)
    applicable = settings["professionalTax"] > 0 and amount > settings["professionalTaxLimit"]
    c["professionalTaxStatus"] = APPLICABLE if applicable else NOT_APPLICABLE
    c["professionalTax"] = settings["professionalTax"] if applicable else 0.0
    c["insurance"] = settings["insuranceDeduction"] if entry["insurance"] else 0.0
    c["pf"] = settings["pf"] if entry["pf"] else 0.0
    amount -= c["professionalTax"] + c["insurance"] + c["pf"]
    c["finalSalary"] = _r2(max(amount, 0.0))
    return attendance, c


def monthly(pay_type: str, month: str) -> dict:
    date_from, date_to = month_range(month)
    result = compute(pay_type, date_from, date_to)
    settings = settings_for(month)
    ids = {r["userId"] for r in result["rows"]}
    marked = attendance_counts(month, ids)
    entries = store.get_many(ENTRIES, [f"{month}:{uid}" for uid in ids])
    for row in result["rows"]:
        entry = _clean_entry(entries.get(f"{month}:{row['userId']}"))
        row["entry"] = entry
        row["attendance"], row["calc"] = payroll(row.get("totalSalary"), marked.get(row["userId"], Counter()), settings, entry)
    result.update(month=month, settings=settings)
    return result


@router.get("")
def salary_block(payType: str = Query(...), month: str = Query(...), current_user: dict = Depends(require_super_admin)):
    if payType not in PAY_TYPES:
        raise HTTPException(status_code=400, detail=f"Pay Type must be one of: {', '.join(PAY_TYPES)}.")
    return monthly(payType, month)


@router.put("/settings")
def save_settings(month: str = Query(...), body: dict = Body(...), current_user: dict = Depends(require_super_admin)):
    month_range(month)
    settings = _clean_settings(body)
    store.put(SETTINGS, month, {"id": month, **settings, "updatedBy": current_user.get("name", "")})
    return {**settings, "saved": True}


@router.put("/entry")
def save_entry(month: str = Query(...), body: dict = Body(...), current_user: dict = Depends(require_super_admin)):
    month_range(month)
    user_id = str((body or {}).get("userId") or "")
    if not store.get("users", user_id):
        raise HTTPException(status_code=404, detail="Employee not found.")
    entry = _clean_entry(body)
    store.put(ENTRIES, f"{month}:{user_id}", {"id": f"{month}:{user_id}", "userId": user_id, "month": month, **entry})
    return entry
