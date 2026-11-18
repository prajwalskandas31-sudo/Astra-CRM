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
"""
import re
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

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
    out = []
    if isinstance(sharing, dict) and sharing.get("present"):
        pct = sharing.get("mode") == "percentage"
        for share in sharing.get("shares") or []:
            if not share.get("userId"):
                continue
            value = _num(share.get("value"))
            out.append((share["userId"], net * value / 100 if pct else value))
    shared = sum(amount for _, amount in out)
    if primary:
        out.append((primary, max(net - shared, 0.0)))
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


@router.get("")
def salary_block(payType: str = Query(...), dateFrom: str = Query(..., alias="from"), dateTo: str = Query(..., alias="to"),
                 current_user: dict = Depends(require_super_admin)):
    if payType not in PAY_TYPES:
        raise HTTPException(status_code=400, detail=f"Pay Type must be one of: {', '.join(PAY_TYPES)}.")
    if not DATE.match(dateFrom) or not DATE.match(dateTo):
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD.")
    if dateFrom > dateTo:
        raise HTTPException(status_code=400, detail="The From date is after the To date.")
    return compute(payType, dateFrom, dateTo)
