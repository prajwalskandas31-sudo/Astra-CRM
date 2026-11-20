"""Running Account Statement Block: the company's money in (Credits) and out (Debits), month by month.

Every month opens at Rs 0 and keeps a running Net Balance (Net = previous balance + Credit - Debit).
Entries come from three sub-blocks plus the payroll:

1. Client Payment Credit - one entry per closed sale (Paid block: E-Signed & Converted, or an Old Client
   approved in Telegram; the same rule as the Salary Block), dated by the Payment Date on its Client
   Information page. Credit = its Net Sales. A Debit adjustment can be typed in.
2. Advance & Expense Payment Debit - each employee's Advance and Expenses for the month (Salary Block).
3. Manual Entry - ad-hoc Credits / Debits typed in by an authorised user.
Salary & Attendance (Salary Block, per month):
   Credit  Absent Deduction, Half Day Deduction
   Debit   Salary Paid
   Neutral Professional Tax, PF, Insurance (shown, never added to or taken from the balance)

Salary Paid is the cash-correct figure agreed with the client (20 Nov 2026): the Final Total Salary
already takes off the absent / half-day deductions and the advance and adds the expenses, so the
Salary Paid debit puts those back (Final + Absent + Half Day - Expenses + PT + PF + Insurance, i.e.
base + incentive - deduction - advance). With the separate Advance / Expenses debits and Absent /
Half Day credits the month then nets to what really left the company.

Payroll lines are dated on the month's last day. Any automatic entry's date can be moved (Adjusted
Date); it then shows in the month of its Adjusted Date.

Who may use it is the "running-account" feature in the Feature Access Block (Super Admin by default),
checked on every request.
"""
import calendar
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

try:
    from backend import store, salary, pdf_tables
    from backend.auth import get_current_user
except ImportError:
    import store
    import salary
    import pdf_tables
    from auth import get_current_user


FEATURE_ID = "running-account"
DEFAULT_ROLES = ("Super Admin",)  # kept in step with CRM_FEATURES in CRMContext.jsx
MANUAL = "ledgerManualEntries"     # server-only: ad-hoc entries
ADJUST = "ledgerAdjustments"       # server-only, by entry key: {"adjustedDate", "debit"}
MAX_AMOUNT = 1_000_000_000
MAX_NARRATION = 300
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
IST = timezone(timedelta(hours=5, minutes=30))
KEY_RE = re.compile(r"^(sale:[A-Za-z0-9_.:-]{1,80}|pay:\d{4}-\d{2}:[A-Za-z0-9_.-]{1,80}:[a-zA-Z]{1,20})$")

CREDIT, DEBIT, NEUTRAL = "Credit", "Debit", "Neutral"
# Sections (sub-blocks) of the statement
CLIENT, ADVANCE, PAYROLL, MANUAL_SECTION = "clientPayment", "advanceExpense", "salaryAttendance", "manual"
SECTION_TITLES = {
    CLIENT: "Client Payment Credit",
    ADVANCE: "Advance & Expense Payment Debit",
    PAYROLL: "Salary & Attendance",
    MANUAL_SECTION: "Manual Entries",
}

router = APIRouter(prefix="/api/running-account", tags=["running-account"])


# ==========================================
# Access
# ==========================================
def _allowed(user: dict) -> bool:
    """Same rule as hasPermission() in CRMContext.jsx: a Feature Access override first, then the role."""
    perms = (store.get("userPermissions", user["id"]) or {}).get("value")
    if isinstance(perms, dict) and isinstance(perms.get(FEATURE_ID), bool):
        return perms[FEATURE_ID]
    return user.get("role") in DEFAULT_ROLES


def require_access(current_user: dict = Depends(get_current_user)) -> dict:
    if not _allowed(current_user):
        raise HTTPException(status_code=403, detail="You do not have access to the Running Account Statement Block.")
    return current_user


# ==========================================
# Helpers
# ==========================================
def rupees(n: float) -> str:
    """Indian grouping: 1234567.5 -> Rs 12,34,567.50"""
    sign = "-" if n < 0 else ""
    whole, frac = f"{abs(n):.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        head = ",".join(re.findall(r"\d{1,2}", head[::-1]))[::-1]
        whole = f"{head},{tail}"
    return f"{sign}₹{whole}.{frac}"


def _month_of(day: str) -> str:
    return (day or "")[:7]


def _last_day(month: str) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    return f"{month}-{calendar.monthrange(year, mon)[1]:02d}"


def _month_name(month: str) -> str:
    return f"{calendar.month_name[int(month[5:7])]} {month[:4]}"


def _today() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def _amount(value, field: str) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be a number.")
    if not (0 <= n <= MAX_AMOUNT) or n != n:
        raise HTTPException(status_code=400, detail=f"{field} must be between 0 and {MAX_AMOUNT:,}.")
    return round(n, 2)


def _date(value, field: str) -> str:
    text = str(value or "").strip()
    if not DATE_RE.match(text):
        raise HTTPException(status_code=400, detail=f"{field} must be a date (YYYY-MM-DD).")
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} is not a real date.")
    return text


def payment_modes_text(info: dict, sale: dict) -> str:
    """'UPI', or 'Multiple Payment of UPI (Rs 5,000.00) + NEFT (Rs 3,000.00)' for several modes."""
    modes = info.get("paymentModes") or sale.get("paymentModes") or []
    rows = [m for m in modes if isinstance(m, dict) and str(m.get("mode") or "").strip()] if isinstance(modes, list) else []
    if len(rows) == 1:
        return str(rows[0]["mode"]).strip()
    if rows:
        return "Multiple Payment of " + " + ".join(
            f"{str(m['mode']).strip()} ({rupees(salary._num(m.get('amount')))})" for m in rows)
    legacy = str(info.get("paymentMode") or sale.get("paymentMode") or "").strip()
    return legacy or "unspecified mode"


# ==========================================
# Entries
# ==========================================
def _entry(key, section, kind, entry_date, narration, credit=0.0, debit=0.0, neutral=0.0, **extra) -> dict:
    return {"key": key, "section": section, "kind": kind, "entryDate": entry_date, "adjustedDate": entry_date,
            "narration": narration, "credit": round(credit, 2), "debit": round(debit, 2), "neutral": round(neutral, 2),
            "adjusted": False, **extra}


def client_entries() -> list:
    paid_sale_ids = {p.get("saleId") for p in store.all("paidClients") if p.get("saleId")}
    out = []
    for sale in salary.closed_sales(paid_sale_ids):
        day = salary.payment_date(sale)
        if not DATE_RE.match(day) or not sale.get("id"):
            continue
        info = salary._info(sale)
        name = " ".join(x for x in (info.get("clientPrefix"), sale.get("clientName") or info.get("clientName")) if x).strip() or "Client"
        service = info.get("serviceName") or sale.get("serviceOpted") or "the service"
        net = sale.get("netSales") if sale.get("netSales") not in (None, "") else info.get("netSales")
        out.append(_entry(f"sale:{sale['id']}", CLIENT, "clientPayment", day,
                          f"Payment received from {name} via {payment_modes_text(info, sale)} for {service}",
                          credit=max(salary._num(net), 0.0), saleId=sale["id"], debitEditable=True))
    return out


def payroll_entries(month: str) -> list:
    """The Salary Block's figures for one month as ledger lines (nothing for months still to come)."""
    if month > _today()[:7]:
        return []
    day = _last_day(month)
    out = []
    for pay_type in salary.PAY_TYPES:
        for row in salary.monthly(pay_type, month)["rows"]:
            c, uid = row["calc"], row["userId"]
            who = f"{row['name']} ({row['employeeId']})" if row.get("employeeId") else row["name"]
            key = lambda kind: f"pay:{month}:{uid}:{kind}"  # noqa: E731
            att = row["attendance"]
            if c["advance"] > 0:
                out.append(_entry(key("advance"), ADVANCE, "advance", day,
                                  f"Advance of {rupees(c['advance'])} taken by {who}", debit=c["advance"], userId=uid))
            if c["expenses"] > 0:
                out.append(_entry(key("expenses"), ADVANCE, "expenses", day,
                                  f"Expenses of {rupees(c['expenses'])} paid to {who}", debit=c["expenses"], userId=uid))
            if c["absentDeduction"] > 0:
                out.append(_entry(key("absent"), PAYROLL, "absentDeduction", day,
                                  f"Absent Deduction - {att['absentCharged']} day(s) - {who}", credit=c["absentDeduction"], userId=uid))
            if c["halfDayDeduction"] > 0:
                out.append(_entry(key("halfDay"), PAYROLL, "halfDayDeduction", day,
                                  f"Half Day Deduction - {att['halfDay']} half day(s) - {who}", credit=c["halfDayDeduction"], userId=uid))
            paid = max(c["finalSalary"] + c["absentDeduction"] + c["halfDayDeduction"] - c["expenses"]
                       + c["professionalTax"] + c["insurance"] + c["pf"], 0.0)
            if paid > 0:
                out.append(_entry(key("salary"), PAYROLL, "salaryPaid", day,
                                  f"Salary paid to {who} for {_month_name(month)}", debit=paid, userId=uid))
            for kind, label in (("professionalTax", "Professional Tax"), ("pf", "PF"), ("insurance", "Insurance")):
                if c[kind] > 0:
                    out.append(_entry(key(kind), PAYROLL, kind, day,
                                      f"{label} of {rupees(c[kind])} - {who} (neutral)", neutral=c[kind], userId=uid))
    return out


def manual_entries() -> list:
    out = []
    for m in store.all(MANUAL):
        amount = salary._num(m.get("amount"))
        credit = m.get("type") == CREDIT
        e = _entry(f"manual:{m['id']}", MANUAL_SECTION, "manual", m.get("entryDate") or m.get("adjustedDate") or "",
                   m.get("narration") or "", credit=amount if credit else 0.0, debit=0.0 if credit else amount,
                   manualId=m["id"], type=m.get("type") or DEBIT, createdBy=m.get("createdBy") or "")
        e["adjustedDate"] = m.get("adjustedDate") or e["entryDate"]
        e["adjusted"] = e["adjustedDate"] != e["entryDate"]
        out.append(e)
    return out


def _apply(entries: list, adjustments: dict) -> list:
    for e in entries:
        adj = adjustments.get(e["key"]) or {}
        if DATE_RE.match(str(adj.get("adjustedDate") or "")):
            e["adjustedDate"] = adj["adjustedDate"]
            e["adjusted"] = adj["adjustedDate"] != e["entryDate"]
        if e.get("debitEditable") and adj.get("debit") not in (None, ""):
            e["debit"] = round(salary._num(adj["debit"]), 2)
    return entries


ORDER = {CLIENT: 0, PAYROLL: 1, ADVANCE: 2, MANUAL_SECTION: 3}


def with_balance(entries: list) -> list:
    """Sorted by Adjusted Date; each entry gets the running Net Balance from an opening of Rs 0."""
    entries = sorted(entries, key=lambda e: (e["adjustedDate"], e["entryDate"], ORDER[e["section"]], e["key"]))
    balance = 0.0
    for e in entries:
        balance = round(balance + e["credit"] - e["debit"], 2)
        e["balance"] = balance
    return entries


def statement(month: str) -> dict:
    salary.month_range(month)  # validates YYYY-MM
    adjustments = {d["id"]: d for d in store.all(ADJUST)}
    # Payroll months whose lines may land in this month: this one plus any moved here by an Adjusted Date
    months = {month} | {k.split(":")[1] for k, a in adjustments.items()
                        if k.startswith("pay:") and _month_of(a.get("adjustedDate")) == month}
    entries = client_entries() + manual_entries()
    for m in sorted(months):
        entries += payroll_entries(m)
    entries = [e for e in _apply(entries, adjustments) if _month_of(e["adjustedDate"]) == month]
    entries = with_balance(entries)
    totals = {"credit": round(sum(e["credit"] for e in entries), 2), "debit": round(sum(e["debit"] for e in entries), 2),
              "neutral": round(sum(e["neutral"] for e in entries), 2)}
    totals["net"] = round(totals["credit"] - totals["debit"], 2)
    return {"month": month, "monthName": _month_name(month), "openingBalance": 0.0, "entries": entries, "totals": totals,
            "sections": SECTION_TITLES}


# ==========================================
# Routes
# ==========================================
@router.get("")
def get_statement(month: str = Query(...), current_user: dict = Depends(require_access)):
    return statement(month)


class Adjustment(BaseModel):
    key: str = Field(..., max_length=200)
    adjustedDate: Optional[str] = Field(None, max_length=10)  # empty -> back to the Entry Date
    debit: Optional[float] = None                               # client payments only; empty -> Rs 0


@router.put("/adjust")
def adjust(req: Adjustment, current_user: dict = Depends(require_access)):
    if not KEY_RE.match(req.key):
        raise HTTPException(status_code=400, detail="Unknown entry.")
    doc = dict(store.get(ADJUST, req.key) or {"id": req.key})
    doc["adjustedDate"] = _date(req.adjustedDate, "Adjusted Date") if req.adjustedDate else ""
    if req.key.startswith("sale:"):
        if not store.get("sales", req.key[5:]):
            raise HTTPException(status_code=404, detail="Sale not found.")
        doc["debit"] = _amount(req.debit, "Debit") if req.debit is not None else ""
    doc.update(updatedBy=current_user.get("name", ""), updatedAt=datetime.now(timezone.utc).isoformat())
    if not doc["adjustedDate"] and not doc.get("debit"):
        store.delete(ADJUST, req.key)
    else:
        store.put(ADJUST, req.key, doc)
    return {"ok": True}


class ManualEntry(BaseModel):
    adjustedDate: str = Field(..., max_length=10)
    narration: str = Field(..., max_length=MAX_NARRATION)
    type: str
    amount: float


def _clean_manual(req: ManualEntry) -> dict:
    if req.type not in (CREDIT, DEBIT):
        raise HTTPException(status_code=400, detail="Transaction Type must be Credit or Debit.")
    narration = req.narration.strip()
    if not narration:
        raise HTTPException(status_code=400, detail="Enter a Narration.")
    amount = _amount(req.amount, "Amount")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be more than ₹0.")
    return {"adjustedDate": _date(req.adjustedDate, "Date"), "narration": narration, "type": req.type, "amount": amount}


@router.post("/manual")
def add_manual(req: ManualEntry, current_user: dict = Depends(require_access)):
    doc = {"id": uuid.uuid4().hex[:16], "entryDate": _today(), **_clean_manual(req),
           "createdBy": current_user.get("name", ""), "createdAt": datetime.now(timezone.utc).isoformat()}
    store.put(MANUAL, doc["id"], doc)
    return doc


@router.put("/manual/{entry_id}")
def edit_manual(entry_id: str, req: ManualEntry, current_user: dict = Depends(require_access)):
    doc = store.get(MANUAL, entry_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Entry not found.")
    doc = {**doc, **_clean_manual(req), "updatedBy": current_user.get("name", ""), "updatedAt": datetime.now(timezone.utc).isoformat()}
    store.put(MANUAL, entry_id, doc)
    return doc


@router.delete("/manual/{entry_id}")
def delete_manual(entry_id: str, current_user: dict = Depends(require_access)):
    if not store.delete(MANUAL, entry_id):
        raise HTTPException(status_code=404, detail="Entry not found.")
    return {"ok": True}


@router.get("/pdf")
def pdf(month: str = Query(...), section: str = Query("all"), current_user: dict = Depends(require_access)):
    data = statement(month)
    entries = data["entries"]
    title = "Running Account Statement"
    if section != "all":
        if section not in SECTION_TITLES:
            raise HTTPException(status_code=400, detail="Unknown section.")
        entries = with_balance([e for e in entries if e["section"] == section])
        title = f"{title} - {SECTION_TITLES[section]}"
    money = lambda n: rupees(n) if n else "-"  # noqa: E731
    rows = [[_dmy(e["entryDate"]), _dmy(e["adjustedDate"]), e["narration"], money(e["credit"]), money(e["debit"]),
             money(e["neutral"]), rupees(e["balance"])] for e in entries]
    credit, debit = sum(e["credit"] for e in entries), sum(e["debit"] for e in entries)
    neutral = sum(e["neutral"] for e in entries)
    rows.append(["", "", "Total", rupees(credit), rupees(debit), rupees(neutral), rupees(credit - debit)])
    body = pdf_tables.render(
        title=title, subtitle=f"{data['monthName']}  |  Opening Balance {rupees(0)}  |  Closing Balance {rupees(credit - debit)}",
        header=["Entry Date", "Adjusted Date", "Narration", "Credit (₹)", "Debit (₹)", "Neutral (₹)", "Net Balance (₹)"],
        rows=rows, widths=[9, 9, 40, 11, 11, 10, 12], numeric_from=3, landscape_page=True, bold_last=True,
    )
    name = f"Running Account Statement {data['monthName']}.pdf"
    return Response(body, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})


def _dmy(day: str) -> str:
    return f"{day[8:10]}/{day[5:7]}/{day[:4]}" if DATE_RE.match(day or "") else (day or "")
