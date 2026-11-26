"""RA Monthly Compliance Tracker (SEBI Research Analyst monthly self-check).

Built from the client's workbook "RA_Monthly_Compliance_Tracker_Unite.xlsx": a Dashboard plus 17 input
sheets (Social Media Bio / Posts, Reco Register, Research Reports, Client Register, MITC, KYC, SCORES,
ODR, Website, UPI and Bank, Client Comms, Advertisements, Policies, Complaint Data, Invoices, Client
Documents). The columns, drop-downs and Compliant / Non-compliant / Pending rules live in the browser
(src/lib/raCompliance.js); the server keeps what the user typed, one record per month per sheet, and
checks only its shape.

Record: collection "raCompliance", id "<YYYY-MM>:<sheet>",
  {"id", "month", "sheet", "data": {<section>: [row, ...]} or {"fields": {...}}, "updatedBy", "updatedAt"}
A row is a flat object of short strings / numbers; rows of the client-linked sheets (MITC, KYC, Invoices,
Client Documents) use the Client Register row's id as their own id.

Who may use it is the "ra-compliance" feature in the Feature Access Block (Super Admin by default).
"""
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query

try:
    from backend import store
    from backend.auth import get_current_user
except ImportError:
    import store
    from auth import get_current_user


FEATURE_ID = "ra-compliance"
DEFAULT_ROLES = ("Super Admin",)  # kept in step with CRM_FEATURES in CRMContext.jsx
COLLECTION = "raCompliance"
IST = timezone(timedelta(hours=5, minutes=30))

# sheet -> its sections ("fields" = one form of single values instead of rows)
SHEETS = {
    "details": ("fields",),
    "socialBio": ("rows",),
    "socialPosts": ("rows",),
    "recoRegister": ("rows",),
    "researchReports": ("rows",),
    "clientRegister": ("rows",),
    "mitc": ("rows",),
    "kyc": ("rows",),
    "scores": ("weeks", "log"),
    "odr": ("weeks", "log"),
    "website": ("rows",),
    "upiBank": ("rows",),
    "clientComms": ("rows",),
    "advertisements": ("rows",),
    "policies": ("rows",),
    "complaintData": ("rows",),
    "invoices": ("rows",),
    "clientDocuments": ("rows",),
}

MONTH_RE = re.compile(r"^(20\d{2})-(0[1-9]|1[0-2])$")
KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,39}$")
MAX_ROWS = 500       # per section (the workbook allows 200 posts, 100 calls, 60 clients)
MAX_FIELDS = 40      # per row
MAX_TEXT = 2000      # characters per value
MAX_ID = 100
MAX_NUMBER = 1_000_000_000_000

router = APIRouter(prefix="/api/ra-compliance", tags=["ra-compliance"])


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
        raise HTTPException(status_code=403, detail="You do not have access to the RA Monthly Compliance Tracker.")
    return current_user


# ==========================================
# Validation
# ==========================================
def check_month(month: str) -> str:
    if not MONTH_RE.match(month or ""):
        raise HTTPException(status_code=400, detail="Month must look like 2026-10 (year, then month).")
    return month


def check_sheet(sheet: str) -> str:
    if sheet not in SHEETS:
        raise HTTPException(status_code=404, detail=f"Unknown compliance sheet '{sheet}'.")
    return sheet


def _clean_value(where: str, key: str, value):
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if value != value or abs(value) > MAX_NUMBER:  # NaN or absurd
            raise HTTPException(status_code=400, detail=f"{where}: '{key}' is not a valid number.")
        return value
    if isinstance(value, str):
        if len(value) > MAX_TEXT:
            raise HTTPException(status_code=400, detail=f"{where}: '{key}' can be at most {MAX_TEXT} characters.")
        return value
    raise HTTPException(status_code=400, detail=f"{where}: '{key}' must be text or a number.")


def _clean_row(where: str, row) -> dict:
    if not isinstance(row, dict):
        raise HTTPException(status_code=400, detail=f"{where} must be an object.")
    if len(row) > MAX_FIELDS:
        raise HTTPException(status_code=400, detail=f"{where} has too many fields.")
    out = {}
    for key, value in row.items():
        if not isinstance(key, str) or not KEY_RE.match(key):
            raise HTTPException(status_code=400, detail=f"{where}: field name '{key}' is not allowed.")
        out[key] = _clean_value(where, key, value)
    rid = out.get("id")
    if not isinstance(rid, str) or not rid.strip() or len(rid) > MAX_ID:
        raise HTTPException(status_code=400, detail=f"{where} needs an id.")
    # Values left empty are not stored
    return {k: v for k, v in out.items() if v not in (None, "")}


def clean_data(sheet: str, data) -> dict:
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Send the sheet's data.")
    sections = SHEETS[sheet]
    unknown = set(data) - set(sections)
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown section(s) for {sheet}: {', '.join(sorted(unknown))}.")
    out = {}
    for section in sections:
        if section == "fields":
            fields = data.get("fields") or {}
            # A form has no rows, so give it the id the row check expects
            out["fields"] = {k: v for k, v in _clean_row("Details", {**fields, "id": "fields"}).items() if k != "id"}
            continue
        rows = data.get(section) or []
        if not isinstance(rows, list):
            raise HTTPException(status_code=400, detail=f"{sheet}.{section} must be a list of rows.")
        if len(rows) > MAX_ROWS:
            raise HTTPException(status_code=400, detail=f"At most {MAX_ROWS} rows per sheet.")
        cleaned, seen = [], set()
        for i, row in enumerate(rows, 1):
            r = _clean_row(f"Row {i}", row)
            if r["id"] in seen:
                raise HTTPException(status_code=400, detail=f"Row {i} repeats the id of an earlier row.")
            seen.add(r["id"])
            cleaned.append(r)
        out[section] = cleaned
    return out


# ==========================================
# Records
# ==========================================
def _record_id(month: str, sheet: str) -> str:
    return f"{month}:{sheet}"


def month_data(month: str) -> dict:
    sheets = {}
    for sheet in SHEETS:
        doc = store.get(COLLECTION, _record_id(month, sheet))
        if doc:
            sheets[sheet] = {"data": doc.get("data") or {}, "updatedBy": doc.get("updatedBy", ""),
                             "updatedAt": doc.get("updatedAt", "")}
    return {"month": month, "sheets": sheets}


def _has_content(data: dict) -> bool:
    return any(bool(v) for v in (data or {}).values())


# ==========================================
# Routes
# ==========================================
@router.get("")
def get_month(month: str = Query(...), current_user: dict = Depends(require_access)):
    """Everything typed for one month, by sheet."""
    return month_data(check_month(month))


# ==========================================
# Reco Register lines from the Research Reports block (backend/reports.py)
# ==========================================
REPORTS = "researchReports"  # reports.REPORTS; read directly so this module stays light
INSTRUMENT_NAMES = {"option": "Options", "future": "Futures", "equity": "Equity"}


def _report_day(record: dict) -> str:
    if record.get("day"):
        return record["day"]
    try:
        return datetime.fromisoformat(record.get("callAt") or record.get("createdAt") or "").astimezone(IST).date().isoformat()
    except ValueError:
        return ""


def reco_row(record: dict) -> dict:
    """One Reco Register line for a Ready report: everything comes from the call the report was built from."""
    d = record.get("details") or {}
    option = d.get("instrument") == "option"
    buy = str(d.get("side") or "").strip().lower() == "buy"
    entry = str(d.get("entry") or "")
    targets = " / ".join(str(t) for t in d.get("targets") or [])
    security = " ".join(p for p in [d.get("symbol") or "", *( [d.get("strike") or "", d.get("optionType") or ""] if option else []),
                                    "FUT" if d.get("instrument") == "future" else ""] if p)
    expiry = record.get("expiry") or ""
    if option:
        call_put = {"CE": "Call", "PE": "Put"}.get(d.get("optionType") or "", "")
    else:
        call_put = "Call" if buy else ("Put" if d.get("side") else "")
    row = {
        "id": f"rep-{record['id']}",
        "reportId": record["id"],
        "date": _report_day(record),
        "nature": " ".join(p for p in [INSTRUMENT_NAMES.get(d.get("instrument"), ""), f"({record['segment']})" if record.get("segment") else ""] if p),
        "security": f"{security} (expiry {expiry})" if security and expiry else security,
        "strike": str(d.get("strike") or "") if option else entry,
        "period": f"Till expiry ({expiry})" if expiry else "",
        "callPut": call_put,
        "buyRate": entry if buy else targets,
        "sellRate": targets if buy else entry,
        "sl": str(d.get("stopLoss") or ""),
        "rationale": "Yes",
        "reportFile": record.get("fileName") or "",
    }
    return {k: v for k, v in row.items() if v not in (None, "")}


def reco_rows_for(month: str) -> list:
    ready = [r for r in store.all(REPORTS)
             if r.get("status") == "Ready" and not r.get("test") and r.get("details") and _report_day(r).startswith(month)]
    ready.sort(key=lambda r: (_report_day(r), r.get("callAt") or r.get("createdAt") or "", r.get("callNumber") or 0))
    return [reco_row(r) for r in ready]


@router.get("/reco-from-reports")
def reco_from_reports(month: str = Query(...), current_user: dict = Depends(require_access)):
    """The month's Reco Register lines, one per Ready research report (test reports left out), oldest first."""
    return {"month": month, "rows": reco_rows_for(check_month(month))}


@router.get("/months")
def list_months(current_user: dict = Depends(require_access)):
    """{month: [sheets with data]}, newest month first; used to copy lists from an earlier month."""
    months = {}
    for doc in store.all(COLLECTION):
        if doc.get("month") and doc.get("sheet") and _has_content(doc.get("data")):
            months.setdefault(doc["month"], []).append(doc["sheet"])
    return {"months": {m: sorted(months[m]) for m in sorted(months, reverse=True)}}


@router.put("/{sheet}")
def save_sheet(sheet: str = Path(...), month: str = Query(...), body: dict = Body(...),
               current_user: dict = Depends(require_access)):
    """body: {"data": {<section>: [rows]}} (details: {"data": {"fields": {...}}}); replaces the sheet for that month."""
    check_month(month)
    check_sheet(sheet)
    data = clean_data(sheet, (body or {}).get("data"))
    doc = {"id": _record_id(month, sheet), "month": month, "sheet": sheet, "data": data,
           "updatedBy": current_user.get("name", ""), "updatedAt": datetime.now(IST).isoformat()}
    store.put(COLLECTION, doc["id"], doc)
    return {"sheet": sheet, "data": data, "updatedBy": doc["updatedBy"], "updatedAt": doc["updatedAt"]}
