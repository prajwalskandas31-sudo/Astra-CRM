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


# ==========================================
# Client Register lines from the CRM
# ==========================================
# Collections read here (written by their own modules); read directly so this module stays light
KRA_RECORDS = "kraRecords"          # backend/kra.py
WELCOME_KIT_LOG = "welcomeKitLog"   # backend/email_kit.py
CLIENT_INVOICES = "clientInvoices"  # backend/invoice_block.py, by sale id
OLD_CLIENT_REVIEWS = "oldClientReviews"  # backend/old_client_review.py
OLD_CLIENT = "Old Client"
OLD_CLIENT_APPROVED = "Old Client - Approved"
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
PRODUCTS = "Equity Cash & Derivatives"
NATURE_OF_SERVICE = "Research recommendation service"
NATURE_OF_ADVICE = "Positional Calls / Intraday Calls"
KYC_THROUGH = "SEBI Registered KRA"
DOC_KEYS = tuple(f"doc{i}" for i in range(1, 8))


def _iso_day(value) -> str:
    """'2026-11-05' from an ISO timestamp (in IST), an ISO date or a dd/mm/yyyy / dd-mm-yyyy date; '' otherwise."""
    text = str(value or "").strip()
    if "T" in text:
        try:
            moment = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return (moment.astimezone(IST) if moment.tzinfo else moment).date().isoformat()
        except ValueError:
            pass
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return m.group(0)
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", text)
    return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}" if m else ""


def _dmy(day: str, sep: str = "/") -> str:
    return f"{day[8:10]}{sep}{day[5:7]}{sep}{day[:4]}" if day else ""


def _pretty(day: str) -> str:
    """'05-Nov-2026'."""
    return f"{day[8:10]}-{MONTHS[int(day[5:7]) - 1]}-{day[:4]}" if day else ""


def _info(sale: dict) -> dict:
    info = sale.get("fullClientInfo") or sale.get("clientInfo")
    return info if isinstance(info, dict) else {}


def _field(sale: dict, record: dict, key: str):
    for source in (_info(sale), sale, record or {}):
        if source.get(key) not in (None, ""):
            return source[key]
    return ""


def _amount(value) -> float:
    try:
        return float(str(value).replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


def _number(value: float):
    return int(value) if float(value).is_integer() else round(value, 2)


def _service(kind: str, sale: dict, record: dict, day: str) -> dict:
    """One service the client paid for: kind 'new' (e-signed on `day`) or 'renewed' (paid on `day`)."""
    name = _field(sale, record, "serviceName") or sale.get("serviceOpted") or ""
    return {
        "kind": kind, "saleId": sale.get("id") or (record or {}).get("saleId") or "", "day": day,
        "pan": str(_field(sale, record, "panNumber")).replace(" ", "").upper(),
        "name": " ".join(str(x) for x in (_field(sale, record, "clientPrefix"), _field(sale, record, "clientName")) if x),
        "service": str(name), "tenure": str(_field(sale, record, "serviceTenure") or ""),
        "end": _iso_day(_field(sale, record, "serviceEndDate")),
        "paymentDay": _iso_day(_field(sale, record, "paymentDate")) or day,
        "gross": _amount(_field(sale, record, "grossSales")),
    }


def crm_clients_for(month: str) -> list:
    """The month's Client Register lines: clients who e-signed in the month (new) and Old Client renewals paid
    in the month, one line per client (by PAN) listing every service, plus the defaults the MITC, KYC, Invoices
    and Client Documents sheets start from (KRA record when there is one, else the Leegality e-sign)."""
    sales = {s["id"]: s for s in store.all("sales") if s.get("id")}

    # Completed e-signs, one per sale (E-Sign Block records, then sales marked e-signed)
    signed = {}
    for r in store.all("eSignRecords"):
        sid, day = r.get("saleId"), _iso_day(r.get("confirmedAt"))
        if sid and day and sid not in signed:
            signed[sid] = (day, r)
    for s in sales.values():
        day = _iso_day(s.get("eSignedAt"))
        if s.get("eSignStatus") == "Completed" and day and s["id"] not in signed:
            signed[s["id"]] = (day, None)

    approved_reviews = {}
    for r in store.all(OLD_CLIENT_REVIEWS):
        if r.get("status") == "approved" and r.get("saleId"):
            approved_reviews[r["saleId"]] = r

    services = []
    for sid, (day, record) in signed.items():
        if day.startswith(month):
            services.append(_service("new", sales.get(sid) or {}, record, day))
    for s in sales.values():
        if s.get("clientType") != OLD_CLIENT:
            continue
        if s.get("status") != OLD_CLIENT_APPROVED and s["id"] not in approved_reviews:
            continue
        review = approved_reviews.get(s["id"]) or {}
        paid = _iso_day(_field(s, review.get("details") or {}, "paymentDate"))
        if paid.startswith(month):
            services.append(_service("renewed", s, review.get("details") or {}, paid))
    if not services:
        return []

    # Every sale of each PAN (any month), so a renewal finds the client's earlier e-sign, KRA and Welcome Kit
    sales_of_pan = {}
    for s in sales.values():
        pan = str(_info(s).get("panNumber") or s.get("panNumber") or "").replace(" ", "").upper()
        if pan:
            sales_of_pan.setdefault(pan, set()).add(s["id"])
    kra = store.all(KRA_RECORDS)
    kits = store.get_value(WELCOME_KIT_LOG, []) or []

    groups = {}
    for svc in services:
        groups.setdefault(f"pan:{svc['pan']}" if svc["pan"] else f"sale:{svc['saleId']}", []).append(svc)

    rows = []
    for key, svcs in groups.items():
        svcs.sort(key=lambda x: (x["day"], x["saleId"]))
        pan = svcs[0]["pan"]
        name = next((x["name"] for x in svcs if x["name"]), "")
        sale_ids = {x["saleId"] for x in svcs if x["saleId"]} | sales_of_pan.get(pan, set())
        new = [x for x in svcs if x["kind"] == "new"]
        renewed = [x for x in svcs if x["kind"] == "renewed"]

        esign_days = sorted(signed[sid][0] for sid in sale_ids if sid in signed)
        esign_day = esign_days[-1] if esign_days else ""
        kra_last = max((r for r in kra if (pan and r.get("pan") == pan) or r.get("saleId") in sale_ids),
                       key=lambda r: r.get("fetchedAt") or "", default=None)
        kra_day = _iso_day((kra_last or {}).get("fetchedAt"))
        kit = max((e for e in kits if e.get("saleId") in sale_ids), key=lambda e: e.get("sentAt") or "", default=None)
        kit_day = _iso_day((kit or {}).get("sentAt"))
        agreement = next((a for a in (kit or {}).get("attachments") or [] if str(a).startswith("Signed Agreement")), "")

        invoices = []
        for x in svcs:
            saved = store.get(CLIENT_INVOICES, x["saleId"]) if x["saleId"] else None
            review = approved_reviews.get(x["saleId"])
            if saved and saved.get("number"):
                invoices.append((saved["number"], _iso_day(saved.get("issuedAt"))))
            elif review and review.get("invoiceNumber"):
                invoices.append((review["invoiceNumber"], _iso_day(review.get("decidedAt"))))
        # A renewal's invoice is emailed when its review is approved; a new client's goes with the Welcome Kit
        invoice_sent = bool(kit) or any(approved_reviews.get(x["saleId"], {}).get("invoiceNumber") for x in renewed)

        total = sum(x["gross"] for x in svcs)
        many = len(svcs) > 1

        def tenure(x):
            span = f" ({_dmy(x['day'])} to {_dmy(x['end'])})" if x["end"] else ""
            return f"{x['service']}: {x['tenure']}{span}" if x["service"] else f"{x['tenure']}{span}"

        def per_service(x, text):
            # With several services each payment says which service it was for
            return f"{text} ({x['service']})" if many and x["service"] else text

        kyc_done = "Yes" if (kra_last or esign_day) else "No"
        mitc_ref = (kra_last or {}).get("fileName") or agreement or (f"Signed Agreement - {name}.pdf" if esign_day else "")
        defaults = {
            "mitc": {"joinDate": kra_day or esign_day or (new or svcs)[0]["day"], "sent": "Yes" if kit else "No",
                     "dateSent": kit_day, "mode": "Email", "signed": "Yes", "dateSigned": esign_day,
                     "ref": mitc_ref, "remarks": "-"},
            "kyc": {"done": kyc_done, "date": kra_day or esign_day, "through": KYC_THROUGH, "docs": "Yes", "remarks": "-"},
            "invoices": {"issued": "Yes" if invoice_sent else "No", "sentToClient": "Yes" if invoice_sent else "No",
                         "invoiceNo": ", ".join(n for n, _ in invoices), "invoiceDate": invoices[0][1] if invoices else "",
                         "amount": _number(total) if total else "", "viaBank": "Yes", "remarks": "-"},
            "clientDocuments": {**{k: "Yes" for k in DOC_KEYS},
                                "proof": f"{_pretty(kit_day)}, by Email" if kit_day else "", "remarks": "-"},
        }
        row = {
            "id": f"crm-{key.replace(':', '-')}",
            "crm": "renewed" if renewed and not new else "new",
            "joinDate": (new or renewed)[0]["day"],
            "name": name,
            "products": PRODUCTS,
            "natureOfService": NATURE_OF_SERVICE,
            "renewalDate": renewed[0]["paymentDay"] if renewed else "",
            "renewedName": name if renewed else "NA",
            "pan": pan,
            "kyc": kyc_done,
            "natureOfAdvice": NATURE_OF_ADVICE,
            "tenure": "; ".join(tenure(x) for x in svcs),
            "recoDetails": "As per Recommendation Register",
            "feeDate": "; ".join(per_service(x, _pretty(x["paymentDay"])) for x in svcs),
            "fees": "; ".join(per_service(x, str(_number(x["gross"]))) for x in svcs),
            "feesTotal": _number(total),
            "saleIds": sorted(x["saleId"] for x in svcs if x["saleId"]),
            "defaults": defaults,
        }
        rows.append({k: v for k, v in row.items() if v not in (None, "")})
    rows.sort(key=lambda r: (r.get("joinDate") or "", r.get("name") or ""))
    return rows


@router.get("/crm-clients")
def crm_clients(month: str = Query(...), current_user: dict = Depends(require_access)):
    """The month's Client Register lines built from the CRM (new e-signs and Old Client renewals), oldest first."""
    return {"month": month, "rows": crm_clients_for(check_month(month))}


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
