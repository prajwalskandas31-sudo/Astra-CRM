"""Audit Report Blocks -> Client and Fee Details (the SEBI Research Analyst half-yearly format).

A financial year has two halves: 1st half April-September, 2nd half October-March. For the chosen half
the CRM works out every figure it can, the user corrects or fills in the rest, and the report downloads
as a whole or row by row (each row with the clients behind its count).

Columns: Individual clients - Resident (A), Non-Resident (B), FPI (C); Non-Individual clients - Resident
(D), Non-Resident (E), FPI (F). The CRM has no residency field, so every client is Resident; B, C, E, F
start at 0 and can be typed in. Individual / Non-Individual is the Client Category on the Client
Information page.

Rows (agreed with the client on 20 Nov 2026):
  (i)   clients with an active service at the end of the previous half (its last day)
  (ii)  clients acquired: e-signs completed during the half (E-Sign Block)
  (iii) clients whose service expired during the half, counted by the date it expired
  (iv)  i + ii - iii (clients at the end of the half), always calculated from the values shown
  5     the most clients with an active service on any one day of the half (and that day)
  6, 7  RAASB deposit details and amount, typed in
  8     fees collected: Net Sales of closed sales whose Payment Date is in the half

A client is one person across all their services: services sharing a valid PAN, a phone number or a lead
are the same client (as in the Subscription History on the Client Information page). A service is a
Paid block record (start = e-sign date) or an approved Old Client payment (start = Payment Date); it is
active from its start until the day before its end date, as in the Telegram Control Block.

Values the user types are kept per half ("2026-27-H1") and override the CRM's figure until reset.
Who may use it is the "audit-reports" feature in the Feature Access Block (Super Admin by default).
"""
import re
from datetime import date, datetime, timedelta
from typing import Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response

try:
    from backend import store, salary, invoice, pdf_tables
    from backend.auth import get_current_user
    from backend.running_account import rupees, IST
except ImportError:
    import store
    import salary
    import invoice
    import pdf_tables
    from auth import get_current_user
    from running_account import rupees, IST


FEATURE_ID = "audit-reports"
DEFAULT_ROLES = ("Super Admin",)  # kept in step with CRM_FEATURES in CRMContext.jsx
VALUES = "auditClientFee"          # server-only, by period: the values the user typed
PERIOD_RE = re.compile(r"^(\d{4})-(\d{2})-H([12])$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
MAX_VALUE = 1_000_000_000_000
MAX_TEXT = 500

COLUMNS = ("A", "B", "C", "D", "E", "F")
COLUMN_TITLES = {"A": "Individual - Resident (A)", "B": "Individual - Non-Resident (B)", "C": "Individual - FPI (C)",
                 "D": "Non-Individual - Resident (D)", "E": "Non-Individual - Non-Resident (E)", "F": "Non-Individual - FPI (F)"}
INDIVIDUAL, NON_INDIVIDUAL = "Individual", "Non-Individual"
RESIDENT_COLUMN = {INDIVIDUAL: "A", NON_INDIVIDUAL: "D"}

# Rows: key, Sr. No., Particulars, kind ("columns": A-F + total; "single": one value; "text": typed text)
ROWS = (
    ("r1", "1", "Number of clients at the end of the previous half yearly period (i)", "columns"),
    ("r2", "2", "Number of clients acquired / signed during the period (ii)", "columns"),
    ("r3", "3", "Number of client subscriptions or agreements expired / terminated during the period (iii)", "columns"),
    ("r4", "4", "Number of clients at the end of the period (iv = i + ii - iii)", "columns"),
    ("r5", "5", "Maximum number of active clients on any day during the period", "single"),
    ("r6", "6", "Details of Deposit maintained with RAASB based on maximum no. of clients", "text"),
    ("r7", "7", "Amount of Deposit maintained with RAASB", "single"),
    ("r8", "8", "Details of Fees collected (in Rs)", "columns"),
)
ROW_KEYS = {r[0] for r in ROWS}
EDITABLE_CELLS = {f"{r}.{c}" for r in ("r1", "r2", "r3", "r8") for c in COLUMNS} | {"r5", "r6", "r7"}

router = APIRouter(prefix="/api/audit-reports/client-fee", tags=["audit-reports"])


# ==========================================
# Access
# ==========================================
def _allowed(user: dict) -> bool:
    perms = (store.get("userPermissions", user["id"]) or {}).get("value")
    if isinstance(perms, dict) and isinstance(perms.get(FEATURE_ID), bool):
        return perms[FEATURE_ID]
    return user.get("role") in DEFAULT_ROLES


def require_access(current_user: dict = Depends(get_current_user)) -> dict:
    if not _allowed(current_user):
        raise HTTPException(status_code=403, detail="You do not have access to the Audit Report Blocks.")
    return current_user


# ==========================================
# Periods
# ==========================================
def period_range(period: str) -> tuple:
    """'2026-27-H1' -> (2026-04-01, 2026-09-30, label); H2 -> 2026-10-01 .. 2027-03-31."""
    m = PERIOD_RE.match(period or "")
    if not m or (int(m.group(1)) + 1) % 100 != int(m.group(2)):
        raise HTTPException(status_code=400, detail="Period must look like 2026-27-H1 (financial year, then H1 or H2).")
    year = int(m.group(1))
    fy = f"FY {year}-{m.group(2)}"
    if m.group(3) == "1":
        return date(year, 4, 1), date(year, 9, 30), f"1st Half (April - September {year}), {fy}"
    return date(year, 10, 1), date(year + 1, 3, 31), f"2nd Half (October {year} - March {year + 1}), {fy}"


def current_period(today: Optional[date] = None) -> str:
    today = today or datetime.now(IST).date()
    fy = today.year if today.month >= 4 else today.year - 1
    return f"{fy}-{(fy + 1) % 100:02d}-H{1 if 4 <= today.month <= 9 else 2}"


# ==========================================
# Clients and their services
# ==========================================
def _day(value) -> Optional[date]:
    """A date from YYYY-MM-DD..., DD/MM/YYYY... or an ISO timestamp (read in IST)."""
    s = str(value or "").strip()
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", s)
    try:
        if m:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
            return date.fromisoformat(s)
        if re.match(r"^\d{4}-\d{2}-\d{2}T", s):
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return (dt.astimezone(IST) if dt.tzinfo else dt).date()
    except ValueError:
        return None
    return None


def end_date(start: Optional[date], tenure) -> Optional[date]:
    """First day the service is no longer active (start + tenure), as computeServiceEndDate() in serviceTenure.js."""
    last = invoice.due_date(start, tenure) if start else None
    return last + timedelta(days=1) if last else None


def _phone(p) -> str:
    digits = re.sub(r"\D", "", str(p or ""))
    return digits[-10:] if len(digits) >= 10 else ""


def _pan(p) -> str:
    p = str(p or "").strip().upper()
    return p if PAN_RE.match(p) else ""


def _category(info: dict) -> str:
    return NON_INDIVIDUAL if str(info.get("clientCategory") or "").strip() == NON_INDIVIDUAL else INDIVIDUAL


class _Clients:
    """Union-find over PAN / phone / lead: services that share any of them belong to one client."""

    def __init__(self):
        self.parent: Dict[str, str] = {}

    def find(self, k: str) -> str:
        while self.parent.setdefault(k, k) != k:
            self.parent[k] = self.parent[self.parent[k]]
            k = self.parent[k]
        return k

    def join(self, keys: list) -> str:
        roots = [self.find(k) for k in keys]
        for r in roots[1:]:
            self.parent[self.find(r)] = self.find(roots[0])
        return roots[0]


def services() -> list:
    """Every service a client has had: {"start", "end", "keys", "name", "pan", "phone", "category", "service", "saleId"}."""
    sales = {s.get("id"): s for s in store.all("sales") if s.get("id")}
    out, paid_sale_ids = [], set()

    def add(start, end, sale, record, service_name, tenure):
        info = salary._info(sale or {}) if sale else {}
        sale, record = sale or {}, record or {}
        pan = _pan(record.get("panNumber") or info.get("panNumber") or sale.get("panNumber"))
        phones = [_phone(x) for x in (record.get("phone"), info.get("phone1"), info.get("phone2"), sale.get("phone1"))]
        lead = record.get("leadId") or sale.get("leadId")
        keys = ([f"pan:{pan}"] if pan else []) + [f"ph:{p}" for p in phones if p] + ([f"lead:{lead}"] if lead else [])
        sid = sale.get("id") or record.get("saleId") or record.get("id")
        out.append({
            "start": start, "end": end, "keys": keys or [f"id:{sid}"], "saleId": sid,
            "name": " ".join(x for x in (record.get("clientPrefix") or info.get("clientPrefix"),
                                         record.get("clientName") or info.get("clientName") or sale.get("clientName")) if x),
            "pan": pan, "phone": next((p for p in phones if p), ""), "category": _category({**record, **info}),
            "service": service_name or "", "tenure": tenure or "",
        })

    for p in store.all("paidClients"):
        sale = sales.get(p.get("saleId"))
        start = _day(p.get("serviceStartDate")) or _day(p.get("eSignedAt"))
        if not start:
            continue
        if p.get("saleId"):
            paid_sale_ids.add(p["saleId"])
        end = _day(p.get("serviceEndDate")) or end_date(start, p.get("serviceTenure"))
        add(start, end, sale, p, p.get("serviceName"), p.get("serviceTenure"))

    for s in sales.values():
        if s["id"] in paid_sale_ids or s.get("status") not in salary.CLOSED_STATUSES:
            continue
        info = salary._info(s)
        tenure = s.get("serviceTenure") or info.get("serviceTenure")
        start = _day(info.get("paymentDate")) or _day(s.get("eSignedAt")) or _day(s.get("date"))
        if not start:
            continue
        end = _day(s.get("serviceEndDate") or info.get("serviceEndDate")) or end_date(start, tenure)
        add(start, end, s, None, s.get("serviceOpted") or info.get("serviceName"), tenure)
    return out


def _grouped(svcs: list) -> dict:
    """client root -> its services."""
    uf = _Clients()
    for s in svcs:
        uf.join(s["keys"])
    groups: Dict[str, list] = {}
    for s in svcs:
        groups.setdefault(uf.find(s["keys"][0]), []).append(s)
    return groups


def _active(s: dict, day: date) -> bool:
    return s["start"] <= day and (s["end"] is None or day < s["end"])


def _detail(s: dict, **extra) -> dict:
    return {"clientName": s["name"], "category": s["category"], "pan": s["pan"], "phone": s["phone"],
            "service": s["service"], "tenure": s["tenure"], "startDate": s["start"].isoformat(),
            "endDate": s["end"].isoformat() if s["end"] else "", **extra}


def esigns(start: date, end: date) -> list:
    """E-signs completed in [start, end]: one per sale, from the E-Sign Block (and sales marked e-signed)."""
    found = {}
    for r in store.all("eSignRecords"):
        sid = r.get("saleId") or r.get("id")
        day = _day(r.get("confirmedAt")) or _day(r.get("date1"))
        if sid and sid not in found and day:
            found[sid] = (day, r)
    for s in store.containing("sales", "Completed"):
        if s.get("eSignStatus") == "Completed" and s.get("id") not in found and _day(s.get("eSignedAt")):
            found[s["id"]] = (_day(s.get("eSignedAt")), None)
    out = []
    for sid, (day, record) in found.items():
        if not (start <= day <= end):
            continue
        sale = store.get("sales", sid) or {}
        info = salary._info(sale)
        record = record or {}
        out.append({"clientName": record.get("clientName") or sale.get("clientName") or info.get("clientName") or "",
                    "category": _category({**record, **info}), "pan": _pan(record.get("panNumber") or info.get("panNumber")),
                    "phone": _phone(record.get("phone") or info.get("phone1")), "service": record.get("serviceName") or info.get("serviceName") or sale.get("serviceOpted") or "",
                    "eSignedOn": day.isoformat(), "documentId": record.get("documentId") or ""})
    return sorted(out, key=lambda d: d["eSignedOn"])


def computed(period: str, today: Optional[date] = None) -> dict:
    """The CRM's own figures for the half: {"cells": {"r1.A": n, ...}, "r5": n, "r5Day": "...", "details": {row: [...]}}."""
    start, end, _ = period_range(period)
    today = today or datetime.now(IST).date()
    groups = _grouped(services())
    cells = {f"{r}.{c}": 0 for r in ("r1", "r2", "r3", "r8") for c in COLUMNS}
    details = {k: [] for k in ("r1", "r2", "r3", "r5", "r8")}

    # (i) active on the last day of the previous half
    before = start - timedelta(days=1)
    for svcs in groups.values():
        live = [s for s in svcs if _active(s, before)]
        if live:
            s = max(live, key=lambda x: x["start"])
            cells[f"r1.{RESIDENT_COLUMN[s['category']]}"] += 1
            details["r1"].append(_detail(s))

    # (ii) e-signs in the half
    for e in esigns(start, end):
        cells[f"r2.{RESIDENT_COLUMN[e['category']]}"] += 1
        details["r2"].append(e)

    # (iii) clients whose service expired in the half (the day it is no longer active), up to today
    for svcs in groups.values():
        ended = [s for s in svcs if s["end"] and start <= s["end"] <= min(end, today)]
        if ended:
            s = max(ended, key=lambda x: x["end"])
            cells[f"r3.{RESIDENT_COLUMN[s['category']]}"] += 1
            details["r3"].append(_detail(s, expiredOn=s["end"].isoformat()))

    # 5: the day of the half (up to today) with the most clients active
    last = min(end, today)
    best, best_day = 0, None
    if last >= start:
        days = (last - start).days + 1
        diff = [0] * (days + 1)
        for svcs in groups.values():
            covered = set()
            for s in svcs:
                lo = max(s["start"], start)
                hi = min((s["end"] - timedelta(days=1)) if s["end"] else last, last)
                if lo <= hi:
                    covered.update(range((lo - start).days, (hi - start).days + 1))
            for d in covered:
                diff[d] += 1
                diff[d + 1] -= 1
        running = 0
        for i in range(days):
            running += diff[i]
            if running > best:
                best, best_day = running, start + timedelta(days=i)
    if best_day:
        for svcs in groups.values():
            live = [s for s in svcs if _active(s, best_day)]
            if live:
                details["r5"].append(_detail(max(live, key=lambda x: x["start"])))

    # 8: fees (Net Sales) of closed sales paid in the half
    paid_sale_ids = {p.get("saleId") for p in store.all("paidClients") if p.get("saleId")}
    for sale in salary.closed_sales(paid_sale_ids):
        day = _day(salary.payment_date(sale))
        if not day or not (start <= day <= end):
            continue
        info = salary._info(sale)
        net = max(salary._num(sale.get("netSales") if sale.get("netSales") not in (None, "") else info.get("netSales")), 0.0)
        cat = _category(info)
        cells[f"r8.{RESIDENT_COLUMN[cat]}"] = round(cells[f"r8.{RESIDENT_COLUMN[cat]}"] + net, 2)
        details["r8"].append({"clientName": sale.get("clientName") or info.get("clientName") or "", "category": cat,
                              "pan": _pan(info.get("panNumber")), "service": info.get("serviceName") or sale.get("serviceOpted") or "",
                              "paymentDate": day.isoformat(), "netSales": round(net, 2), "grossSales": salary._num(info.get("grossSales"))})

    for k in details:
        details[k].sort(key=lambda d: (d.get("clientName") or "").lower())
    details["r8"].sort(key=lambda d: d["paymentDate"])
    return {"cells": cells, "r5": best, "r5Day": best_day.isoformat() if best_day else "", "details": details}


def report(period: str) -> dict:
    start, end, label = period_range(period)
    auto = computed(period)
    saved = store.get(VALUES, period) or {}
    overrides = {k: v for k, v in (saved.get("values") or {}).items() if k in EDITABLE_CELLS}
    value = lambda k: overrides.get(k, auto["cells"][k])  # noqa: E731

    rows = []
    for key, sr, title, kind in ROWS:
        row = {"key": key, "srNo": sr, "particulars": title, "kind": kind}
        if kind == "columns":
            if key == "r4":
                cells = {c: rows[0]["cells"][c] + rows[1]["cells"][c] - rows[2]["cells"][c] for c in COLUMNS}
                row.update(cells=cells, auto={}, edited=[])
            else:
                row.update(cells={c: value(f"{key}.{c}") for c in COLUMNS},
                           auto={c: auto["cells"][f"{key}.{c}"] for c in COLUMNS},
                           edited=[c for c in COLUMNS if f"{key}.{c}" in overrides])
            row["total"] = round(sum(row["cells"].values()), 2)
        else:
            default = {"r5": auto["r5"], "r6": "", "r7": 0}[key]
            row.update(value=overrides.get(key, default), auto=default, edited=key in overrides)
            row["total"] = row["value"]
            if key == "r5":
                row["day"] = auto["r5Day"]
        rows.append(row)
    return {"period": period, "label": label, "from": start.isoformat(), "to": end.isoformat(), "rows": rows,
            "columns": COLUMN_TITLES, "details": auto["details"], "updatedBy": saved.get("updatedBy", ""),
            "updatedAt": saved.get("updatedAt", ""), "currentPeriod": current_period()}


# ==========================================
# Routes
# ==========================================
@router.get("")
def get_report(period: str = Query(...), current_user: dict = Depends(require_access)):
    return report(period)


@router.put("")
def save_values(period: str = Query(...), body: dict = Body(...), current_user: dict = Depends(require_access)):
    """body: {"values": {"r1.A": 12, "r6": "text", ...}}; a key missing or null goes back to the CRM's figure."""
    period_range(period)
    raw = (body or {}).get("values")
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="Send the values to keep.")
    values = {}
    for k, v in raw.items():
        if k not in EDITABLE_CELLS or v is None or v == "":
            continue
        if k == "r6":
            values[k] = str(v).strip()[:MAX_TEXT]
            continue
        try:
            n = float(v)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"{k} must be a number.")
        if not (0 <= n <= MAX_VALUE):
            raise HTTPException(status_code=400, detail=f"{k} must be 0 or more.")
        values[k] = round(n, 2) if k.startswith("r8") or k == "r7" else int(round(n))
    store.put(VALUES, period, {"id": period, "values": values, "updatedBy": current_user.get("name", ""),
                               "updatedAt": datetime.now(IST).isoformat()})
    return report(period)


def _fmt(row: dict, v) -> str:
    if row["key"] in ("r8", "r7"):
        return rupees(float(v or 0))
    return str(v if v not in (None, "") else "")


@router.get("/pdf")
def pdf(period: str = Query(...), rows: str = Query(""), current_user: dict = Depends(require_access)):
    data = report(period)
    wanted = [k for k in rows.split(",") if k in ROW_KEYS] or [r[0] for r in ROWS]
    head1 = ["Sr. No.", "Particulars", "Details of Individual clients", "", "", "Details of Non-Individual clients", "", "",
             "Total (A+B+C+D+E+F)"]
    head2 = ["", "", "Resident (A)", "Non-Resident (B)", "FPI (C)", "Resident (D)", "Non-Resident (E)", "FPI (F)", ""]
    body, spans = [head1, head2], [("SPAN", (2, 0), (4, 0)), ("SPAN", (5, 0), (7, 0)), ("SPAN", (0, 0), (0, 1)),
                                   ("SPAN", (1, 0), (1, 1)), ("SPAN", (8, 0), (8, 1))]
    for row in data["rows"]:
        if row["key"] not in wanted:
            continue
        r = len(body)
        if row["kind"] == "columns":
            body.append([row["srNo"], row["particulars"], *[_fmt(row, row["cells"][c]) for c in COLUMNS], _fmt(row, row["total"])])
        else:
            text = _fmt(row, row["value"])
            if row["key"] == "r5" and row.get("day") and not row["edited"]:
                text = f"{text} (on {_dmy(row['day'])})"
            body.append([row["srNo"], row["particulars"], text, "", "", "", "", "", _fmt(row, row["total"])])
            spans.append(("SPAN", (2, r), (7, r)))
    extra = _details_table(data, wanted[0]) if len(wanted) == 1 else None
    doc = pdf_tables.render(
        title="Client and Fee Details", subtitle=data["label"], header=[], rows=body, header_rows=2,
        widths=[5, 30, 9, 9, 7, 9, 9, 7, 10], numeric_from=2, landscape_page=True, spans=spans,
        extra=[extra] if extra else None,
    )
    name = f"Client and Fee Details {period}{'' if len(wanted) == len(ROWS) else ' ' + '-'.join(wanted)}.pdf"
    return Response(doc, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})


DETAIL_COLUMNS = {
    "r1": [("clientName", "Client"), ("category", "Category"), ("pan", "PAN"), ("service", "Service"), ("startDate", "Start"), ("endDate", "Ends")],
    "r2": [("clientName", "Client"), ("category", "Category"), ("pan", "PAN"), ("service", "Service"), ("eSignedOn", "E-Signed On"), ("documentId", "Document ID")],
    "r3": [("clientName", "Client"), ("category", "Category"), ("pan", "PAN"), ("service", "Service"), ("startDate", "Start"), ("expiredOn", "Expired On")],
    "r5": [("clientName", "Client"), ("category", "Category"), ("pan", "PAN"), ("service", "Service"), ("startDate", "Start"), ("endDate", "Ends")],
    "r8": [("clientName", "Client"), ("category", "Category"), ("pan", "PAN"), ("service", "Service"), ("paymentDate", "Payment Date"), ("netSales", "Net Sales (Rs)")],
}


def _dmy(day: str) -> str:
    return f"{day[8:10]}/{day[5:7]}/{day[:4]}" if re.match(r"^\d{4}-\d{2}-\d{2}$", day or "") else (day or "")


def _details_table(data: dict, key: str) -> Optional[dict]:
    """A single row's download also lists the clients behind the CRM's count."""
    cols = DETAIL_COLUMNS.get(key)
    items = data["details"].get(key) or []
    if not cols or not items:
        return None
    dated = {"startDate", "endDate", "eSignedOn", "expiredOn", "paymentDate"}
    rows = [[rupees(d[k]) if k == "netSales" else (_dmy(d.get(k, "")) if k in dated else d.get(k, "")) for k, _ in cols]
            for d in items]
    title = next(t for k, _, t, _ in ROWS if k == key)
    return {"title": f"{title}: the {len(items)} client(s) counted by the CRM",
            "note": "Values typed into the report are not reflected in this list.",
            "header": [t for _, t in cols], "rows": rows, "widths": [24, 12, 12, 22, 12, 14]}
