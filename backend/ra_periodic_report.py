"""RA Periodic Report Block: the SEBI Research Analyst half-yearly periodic report, in 11 sub-blocks.

Sub-blocks (one sheet each in the Excel download, laid out as in RA_Periodic_Report_31-03-2026.xlsx):
  1 General Details, 2 Complaints, 3 Clients And Fees, 4 Branch Address, 5 Website Details,
  6 Details Of Social Media, 7 Bank Details, 8 List of Directors & Partners, 9 Shareholding Details,
  10 NISM Certification Details, 11 UPI Handle.

Periods are the halves of the financial year, as in the Audit Report Blocks: "2025-26-H2" is the half
year ended 31 March 2026. For the chosen half the CRM fills in what it already knows (the "auto" values:
Company Profile, Branch Profiles, company bank accounts / UPI IDs, active users, Ready research reports
and the Audit Report's Client and Fee Details); the user types the rest and can type over any auto value.

What the user typed is kept per half under "raPeriodicReport":
  general / complaints / clientsFees: {field key: text}; a key that is missing uses the auto value
  branches, websites, social, banks, directors, shareholding, nism, upi: a list of rows, or missing to
  use the CRM's rows. The page (src/components/raPeriodicReport.js) owns the fields and the layout, so
  the server only checks shape and size.

Who may use it is the "ra-periodic-report" feature in the Feature Access Block (Super Admin by default).
"""
import json
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

try:
    from backend import store, audit_report, reports
    from backend.auth import get_current_user
    from backend.running_account import IST
    from backend.sync import INDIAN_STATES
except ImportError:
    import store
    import audit_report
    import reports
    from auth import get_current_user
    from running_account import IST
    from sync import INDIAN_STATES


FEATURE_ID = "ra-periodic-report"
DEFAULT_ROLES = ("Super Admin",)  # kept in step with CRM_FEATURES in CRMContext.jsx
SAVED = "raPeriodicReport"         # server-only, by period

VALUE_SECTIONS = ("general", "complaints", "clientsFees")
TABLES = ("branches", "websites", "social", "banks", "directors", "shareholding", "nism", "upi")
KEY_RE = re.compile(r"^[A-Za-z0-9_.]{1,40}$")
MAX_KEYS = 200
MAX_ROWS = 200
MAX_COLUMNS = 20
MAX_TEXT = 1000
MAX_BYTES = 400_000
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
PINCODE_RE = re.compile(r"(?<!\d)(\d{6})(?!\d)")

router = APIRouter(prefix="/api/ra-periodic-report", tags=["ra-periodic-report"])


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
        raise HTTPException(status_code=403, detail="You do not have access to the RA Periodic Report Block.")
    return current_user


# ==========================================
# What the CRM already knows
# ==========================================
def _text(v) -> str:
    return str(v if v is not None else "").strip()


def _pan_from_gstin(gstin: str) -> str:
    """A GSTIN carries the holder's PAN in characters 3-12."""
    pan = _text(gstin).upper()[2:12]
    return pan if PAN_RE.match(pan) else ""


def _address(text, state="") -> dict:
    """Free-text address -> the report's address lines; the 6-digit pincode is picked out when present."""
    lines = [x.strip(" ,") for x in re.split(r"[\r\n]+", _text(text)) if x.strip(" ,")]
    if len(lines) <= 1 and lines:
        parts = [p.strip() for p in lines[0].split(",") if p.strip()]
        half = (len(parts) + 1) // 2
        lines = [", ".join(parts[:half]), ", ".join(parts[half:])] if len(parts) > 1 else parts
    pin = PINCODE_RE.search(_text(text))
    return {"line1": lines[0] if lines else "", "line2": ", ".join(lines[1:]), "state": _text(state),
            "city": "", "district": "", "pincode": pin.group(1) if pin else "", "country": "India" if text else ""}


# Branch Profiles (Settings) keeps the address in these fields; branches saved before them only have "address"
BRANCH_ADDRESS_FIELDS = {"line1": "addressLine1", "line2": "addressLine2", "state": "state", "city": "city",
                         "district": "district", "pincode": "pincode", "country": "country"}


def _state_in(text) -> str:
    """The Indian State or UT named in a free-text address (the longest match, so "Andhra Pradesh" beats "Pradesh")."""
    low = f" {re.sub(r'[^a-z0-9]+', ' ', _text(text).lower())} "
    hits = [s for s in INDIAN_STATES if f" {re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()} " in low]
    if not hits and " delhi " in low:
        hits = ["Delhi (NCT)"]
    return max(hits, key=len) if hits else ""


def _branch_address(branch: dict) -> dict:
    """One Branch Address row from a Branch Profile."""
    row = {k: _text(branch.get(src)) for k, src in BRANCH_ADDRESS_FIELDS.items()}
    if any(row.values()):
        row["country"] = row["country"] or "India"
    else:
        row = _address(branch.get("address"), _state_in(branch.get("address")))
    return row | {"name": _text(branch.get("name"))}


def _in_period(stamp, start, end) -> bool:
    day = audit_report._day(stamp)
    return bool(day and start <= day <= end)


def auto_values(period: str) -> dict:
    """The CRM's own values for every sub-block of the half."""
    start, end, _ = audit_report.period_range(period)
    profile = reports.company_profile()
    accounts = [a for a in (profile.get("bankAccounts") or []) if isinstance(a, dict)]
    branches = [b for b in store.all("branches") if isinstance(b, dict)]
    users = [u for u in store.all("users") if _text(u.get("status")) != "Inactive"]
    # Point 35: every Ready report in the Research Reports Block whose call falls in the half (test reports too,
    # as the block lists them); Held / Queued reports are not counted
    ready = [r for r in store.all(reports.REPORTS)
             if r.get("status") == reports.STATUS_READY
             and _in_period(r.get("callAt") or r.get("createdAt"), start, end)]

    company = _text(profile.get("companyName"))
    registered = _address(profile.get("registeredAddress"), profile.get("state"))
    general = {
        "registeredName": company,
        "tradeName": company,
        "pan": _pan_from_gstin(profile.get("gstin")),
        "sebiRegNo": _text(profile.get("sebiRegistrationNumber")).upper(),
        "logo": "Yes" if profile.get("companyLogo") else "No",
        "contactMobile": _text(profile.get("contact")),
        "contactEmail": _text(profile.get("email")),
        "raCount": "",
        "researchReports": str(len(ready)),
        # Point 38: active users whose Education (User Directory) is Graduate
        "employees": str(sum(1 for u in users if _text(u.get("education")) == "Graduate")),
        "upiApplied": "Yes" if any(_text(a.get("upiId")) for a in accounts) else "No",
    }
    for prefix in ("reg", "corr", "ppb"):  # registered, correspondence, principal place of business
        general.update({f"{prefix}.{k}": v for k, v in registered.items()})

    fee = audit_report.report(period)
    clients_fees = {}
    for row in fee["rows"]:
        if row["kind"] == "columns":
            clients_fees.update({f"{row['key']}.{c}": row["cells"][c] for c in audit_report.COLUMNS})
        else:
            clients_fees[row["key"]] = row["value"]

    return {
        "general": general,
        "complaints": {},
        "clientsFees": clients_fees,
        "branches": [_branch_address(b) for b in branches],
        "websites": [{"url": _text(profile.get("website"))}] if _text(profile.get("website")) else [],
        "social": [],
        "banks": [{"holderName": company, "accountNo": _text(a.get("accountNumber")), "accountType": _text(a.get("accountType")).upper(),
                   "ifsc": _text(a.get("ifscCode")).upper(), "bankName": _text(a.get("bankName")), "branch": _text(a.get("bankBranch"))}
                  for a in accounts if _text(a.get("accountNumber"))],
        "directors": [],
        "shareholding": [],
        "nism": [],
        "upi": [{"upiId": _text(a.get("upiId"))} for a in accounts if _text(a.get("upiId"))],
    }


# ==========================================
# Saved values
# ==========================================
def _clean_value(v) -> str:
    if isinstance(v, bool):
        return "Yes" if v else "No"
    if v is None or isinstance(v, (int, float, str)):
        return _text(v)[:MAX_TEXT]
    raise HTTPException(status_code=400, detail="Values must be text or numbers.")


def _clean_map(raw, name: str) -> dict:
    if raw is None:
        return {}
    if not isinstance(raw, dict) or len(raw) > MAX_KEYS:
        raise HTTPException(status_code=400, detail=f"{name} must be a list of up to {MAX_KEYS} values.")
    out = {}
    for k, v in raw.items():
        if not KEY_RE.match(str(k)):
            raise HTTPException(status_code=400, detail=f"{name}: '{str(k)[:40]}' is not a field.")
        out[k] = _clean_value(v)
    return out


def clean(data) -> dict:
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Send the report's values.")
    out = {s: _clean_map(data.get(s), s) for s in VALUE_SECTIONS}
    for t in TABLES:
        rows = data.get(t)
        if rows is None:
            continue  # the CRM's rows are used
        if not isinstance(rows, list) or len(rows) > MAX_ROWS:
            raise HTTPException(status_code=400, detail=f"{t} must be a list of up to {MAX_ROWS} rows.")
        cleaned = []
        for row in rows:
            if not isinstance(row, dict) or len(row) > MAX_COLUMNS:
                raise HTTPException(status_code=400, detail=f"Each {t} row must be a set of up to {MAX_COLUMNS} values.")
            cleaned.append(_clean_map(row, t))
        out[t] = cleaned
    if len(json.dumps(out)) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="The report is too large to save.")
    return out


def _previous(period: str) -> Optional[dict]:
    """The latest other half that has been saved (the closest earlier one first), to copy from."""
    others = sorted((d for d in store.all(SAVED) if d.get("id") != period and isinstance(d.get("data"), dict)),
                    key=lambda d: d["id"], reverse=True)
    pick = next((d for d in others if d["id"] < period), others[0] if others else None)
    return {"period": pick["id"], "label": audit_report.period_range(pick["id"])[2], "data": pick["data"]} if pick else None


def payload(period: str) -> dict:
    start, end, label = audit_report.period_range(period)
    saved = store.get(SAVED, period) or {}
    return {"period": period, "label": label, "from": start.isoformat(), "to": end.isoformat(),
            "auto": auto_values(period), "saved": saved.get("data") or {}, "previous": _previous(period),
            "updatedBy": saved.get("updatedBy", ""), "updatedAt": saved.get("updatedAt", ""),
            "currentPeriod": audit_report.current_period()}


# ==========================================
# Routes
# ==========================================
@router.get("")
def get_report(period: str = Query(..., max_length=12), current_user: dict = Depends(require_access)):
    return payload(period)


@router.put("")
def save_report(period: str = Query(..., max_length=12), body: dict = Body(...), current_user: dict = Depends(require_access)):
    """body: {"data": {"general": {...}, "complaints": {...}, "clientsFees": {...}, "branches": [...] | null, ...}}"""
    audit_report.period_range(period)
    data = clean((body or {}).get("data"))
    store.put(SAVED, period, {"id": period, "data": data, "updatedBy": current_user.get("name", ""),
                              "updatedAt": datetime.now(IST).isoformat()})
    return payload(period)
