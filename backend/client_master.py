"""Client Master block: look a client up by PAN or mobile number.

Shows what was entered on the Client Information Page (every submission, newest first), when the
Leegality agreement was signed, the invoices emailed to the client (downloadable), and the client's
grievance files: up to 10 uploads per client per day, renamable, filterable by upload date.

The search runs here, over every team's records, because a browser only holds its own team's.
Who may use it is the "client-master" feature in the Feature Access Block (Super Admin and Admin by
default), checked on every request.
"""
import base64
import re
from urllib.parse import quote
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

try:
    from backend import store, invoice
    from backend.auth import get_current_user
    from backend.old_client_review import REVIEWS, INVOICE_PDFS
except ImportError:
    import store
    import invoice
    from auth import get_current_user
    from old_client_review import REVIEWS, INVOICE_PDFS


FEATURE_ID = "client-master"
DEFAULT_ROLES = ("Super Admin", "Admin")  # kept in step with CRM_FEATURES in CRMContext.jsx
GRIEVANCES = "clientGrievances"           # file details; server-only (not in sync.POLICIES)
GRIEVANCE_FILES = "clientGrievanceFiles"  # file contents, apart so listing never loads them
MAX_FILES_PER_DAY = 10
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_NAME_CHARS = 150
IST = timezone(timedelta(hours=5, minutes=30))
PAN_RE = re.compile(r"[A-Z]{5}[0-9]{4}[A-Z]")
KEY_RE = re.compile(r"(PAN):([A-Z]{5}[0-9]{4}[A-Z])|(MOBILE):([0-9]{10})")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")

# Client Information Page fields shown in the block (attachments and their data stay out)
DETAIL_FIELDS = ("clientType", "panNumber", "clientCategory", "clientPrefix", "clientName", "firmName", "gstin",
                 "email", "phone1", "phone2", "clientState", "paymentDate", "serviceName", "serviceTenure",
                 "serviceEndDate", "transactionNumbers", "grossSales", "netSales", "gst", "submissionDate")

router = APIRouter(prefix="/api/client-master", tags=["client-master"])


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
        raise HTTPException(status_code=403, detail="You do not have access to the Client Master block.")
    return current_user


# ==========================================
# Finding the client
# ==========================================
def _pan(value) -> str:
    return str(value or "").replace(" ", "").upper()


def _mobile(value) -> str:
    """The 10-digit Indian mobile number in `value` (+91 / 0 prefixes and separators dropped), or ''."""
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits if len(digits) == 10 else ""


def parse_query(q: str) -> tuple:
    """('PAN', 'ABCDE1234F') or ('MOBILE', '9876543210'); 400 for anything else."""
    text = (q or "").strip()
    if PAN_RE.fullmatch(_pan(text)):
        return "PAN", _pan(text)
    mobile = _mobile(text)
    if mobile and not re.search(r"[A-Za-z]", text):
        return "MOBILE", mobile
    raise HTTPException(status_code=400, detail="Enter a 10-character PAN (e.g. ABCDE1234F) or a 10-digit mobile number.")


def _infos(doc: dict) -> list:
    """The Client Information Page dicts a record holds (itself counts for flat sales/paid/e-sign records)."""
    found = [doc[k] for k in ("fullClientInfo", "clientInfo", "details") if isinstance(doc.get(k), dict)]
    return found + [doc]


def _matches(doc: dict, kind: str, value: str) -> bool:
    for info in _infos(doc):
        if kind == "PAN" and _pan(info.get("panNumber")) == value:
            return True
        if kind == "MOBILE" and value in {_mobile(info.get(k)) for k in ("phone1", "phone2", "phone")}:
            return True
    return False


def _records(collection: str, kind: str, value: str) -> list:
    # SQL pre-filter: the PAN itself, or the mobile's last 5 digits (which survive "98765 43210" style spacing)
    needle = value if kind == "PAN" else value[-5:]
    return [d for d in store.containing(collection, needle) if _matches(d, kind, value)]


def _clean(info: dict) -> dict:
    out = {k: info.get(k) for k in DETAIL_FIELDS if info.get(k) not in (None, "")}
    modes = info.get("paymentModes")
    if isinstance(modes, list):
        out["paymentModes"] = [{"mode": str(m.get("mode") or ""), "amount": m.get("amount")}
                               for m in modes if isinstance(m, dict) and (m.get("mode") or m.get("amount"))]
    sharing = info.get("employeeSharing")
    if isinstance(sharing, dict) and sharing.get("present"):
        out["employeeSharing"] = {"mode": sharing.get("mode"), "shares": [
            {"name": s.get("name") or s.get("employeeName") or "", "value": s.get("value")}
            for s in sharing.get("shares") or [] if isinstance(s, dict)]}
    return out


def _sale_day(sale: dict) -> str:
    info = sale.get("fullClientInfo") or {}
    return str(info.get("submissionDate") or sale.get("date") or "")


def _submissions(sales: list, leads: list) -> list:
    """Every Client Information Page submission, newest first: one per sale, plus leads whose
    submission has no sale on file."""
    out, sale_leads = [], set()
    for s in sales:
        info = s.get("fullClientInfo") if isinstance(s.get("fullClientInfo"), dict) else s
        sale_leads.add(s.get("leadId"))
        out.append({"saleId": s.get("id"), "leadId": s.get("leadId"), "date": _sale_day(s),
                    "submittedBy": s.get("employeeName") or "", "status": s.get("status") or "",
                    "details": {**_clean(info), "clientType": s.get("clientType") or info.get("clientType") or ""}})
    for lead in leads:
        info = lead.get("clientInfo")
        if isinstance(info, dict) and info and lead.get("id") not in sale_leads:
            out.append({"saleId": None, "leadId": lead.get("id"), "date": str(info.get("submissionDate") or ""),
                        "submittedBy": lead.get("assignedToName") or "", "status": lead.get("disposition") or "",
                        "details": _clean(info)})
    out.sort(key=lambda x: x["date"], reverse=True)
    return out


def _signings(sales: list, esigns: list, paid: list) -> list:
    """When the Leegality agreement was signed, one row per document, newest first."""
    rows = {}
    for r in esigns:
        rows[r.get("documentId") or r.get("id")] = {
            "documentId": r.get("documentId") or "", "signedAt": r.get("confirmedAt") or "",
            "serviceName": r.get("serviceName") or "", "serviceTenure": r.get("serviceTenure") or "",
            "signatureType": r.get("usedSignatureType") or "", "saleId": r.get("saleId")}
    for s in sales:
        doc = s.get("eSignDocumentId")
        if doc and doc not in rows and (s.get("eSignedAt") or s.get("eSignStatus") == "Completed"):
            info = s.get("fullClientInfo") or {}
            rows[doc] = {"documentId": doc, "signedAt": s.get("eSignedAt") or "",
                         "serviceName": s.get("serviceOpted") or info.get("serviceName") or "",
                         "serviceTenure": s.get("serviceTenure") or "", "signatureType": "", "saleId": s.get("id")}
    for p in paid:
        doc = p.get("documentId")
        if doc and doc not in rows and (p.get("signedAt") or p.get("eSignedAt")):
            rows[doc] = {"documentId": doc, "signedAt": p.get("signedAt") or p.get("eSignedAt"),
                         "serviceName": p.get("serviceName") or "", "serviceTenure": p.get("serviceTenure") or "",
                         "signatureType": "", "saleId": p.get("saleId")}
    return sorted(rows.values(), key=lambda r: str(r["signedAt"] or ""), reverse=True)


def _invoices(reviews: list) -> list:
    """Invoices emailed to the client (approved Old Client renewals), newest first."""
    out = []
    for r in reviews:
        if r.get("status") != "approved" or not r.get("invoiceNumber"):
            continue
        d = r.get("details") or {}
        out.append({"id": r["id"], "invoiceNumber": r["invoiceNumber"], "sentAt": r.get("decidedAt") or "",
                    "emailedTo": r.get("emailedTo") or d.get("email") or "", "fileName": r.get("invoiceFile") or "",
                    "serviceName": d.get("serviceName") or "", "serviceTenure": d.get("serviceTenure") or "",
                    "grossSales": d.get("grossSales") or "", "approvedBy": r.get("decidedBy") or ""})
    return sorted(out, key=lambda x: x["sentAt"], reverse=True)


def _with_sales(collection: str, found: list, sale_ids: set) -> list:
    """`found` plus the records of the client's sales that lack the PAN / phone searched for."""
    have = {d.get("id") for d in found}
    for sale_id in sale_ids:
        found += [d for d in store.containing(collection, sale_id) if d.get("saleId") == sale_id and d.get("id") not in have]
        have = {d.get("id") for d in found}
    return found


KRA_RECORDS = "kraRecords"        # backend/kra.py
WELCOME_KIT_LOG = "welcomeKitLog"  # backend/email_kit.py
OLD_CLIENT = "Old Client"
DEAD_SALE = ("Rejected", "Declined")


def _iso_day(value) -> str:
    text = str(value or "").strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return m.group(0)
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", text)
    return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}" if m else ""


def client_status(sales: list, paid: list, pan: str, today: Optional[str] = None) -> dict:
    """The five-step overview at the top of the Client MASTER: KRA, eKYC/MITC, Welcome Kit, Service, Expired."""
    today = today or datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
    sale_ids = {s.get("id") for s in sales if s.get("id")}

    kra = [r for r in store.all(KRA_RECORDS) if (pan and r.get("pan") == pan) or r.get("saleId") in sale_ids]
    kra.sort(key=lambda r: r.get("fetchedAt") or "")
    kra_last = kra[-1] if kra else None

    # e-KYC / MITC runs on the client's latest new-client sale (an Old Client renewal never e-signs)
    live = [s for s in sales if s.get("clientType") != OLD_CLIENT and not any(w in str(s.get("status") or "") for w in DEAD_SALE)]
    live.sort(key=lambda s: (_sale_day(s), str(s.get("id") or "")))
    sale = live[-1] if live else None
    # The latest sale's own e-sign decides; with no open sale, any completed e-sign of the client counts
    signed = (sale.get("eSignStatus") == "Completed") if sale else         (any(s.get("eSignStatus") == "Completed" for s in sales) or any(p.get("eSignedAt") for p in paid))
    details = (sale or {}).get("eSignDetails") or {}
    link_sent = bool(sale and (sale.get("eSignDocumentId") or details.get("dispatchedAt")))
    signed_at = next((p.get("eSignedAt") for p in sorted(paid, key=lambda p: p.get("serviceStartDate") or "", reverse=True)
                      if p.get("eSignedAt")), "") or next((s.get("eSignedAt") for s in sales if s.get("eSignedAt")), "")

    kits = [e for e in (store.get_value(WELCOME_KIT_LOG, []) or []) if e.get("saleId") in sale_ids]
    kits.sort(key=lambda e: e.get("sentAt") or "")
    kit_sale = next((s for s in reversed(live) if s.get("eSignStatus") == "Completed"), None) or sale

    current = list(paid)
    running = [p for p in current if p.get("status") != "Service Expired"
               and (not p.get("serviceEndDate") or str(p["serviceEndDate"]) > today)]
    enabled = [p for p in running if isinstance(p.get("segments"), list) and p["segments"]]
    latest = max(current, key=lambda p: str(p.get("serviceEndDate") or ""), default=None)
    expired = bool(current) and not running

    return {
        "kra": {"completed": bool(kra_last), "kycStatus": (kra_last or {}).get("kycStatus") or "",
                "fetchedAt": (kra_last or {}).get("fetchedAt") or "", "saleId": (sale or {}).get("id")},
        "ekyc": {"completed": signed, "linkSent": link_sent or signed, "saleId": (sale or {}).get("id"),
                 "eSignStatus": (sale or {}).get("eSignStatus") or "", "documentId": (sale or {}).get("eSignDocumentId") or "",
                 "signedAt": _iso_day(signed_at),
                 # Only when every sale is an Old Client renewal; a rejected new-client sale still needs eKYC
                 "oldClientOnly": bool(sales) and all(s.get("clientType") == OLD_CLIENT for s in sales)},
        "welcomeKit": {"sent": bool(kits), "sentAt": (kits[-1] if kits else {}).get("sentAt") or "",
                       "to": (kits[-1] if kits else {}).get("to") or "", "saleId": (kit_sale or {}).get("id")},
        "service": {"enabled": bool(enabled), "hasService": bool(current),
                    "services": [{"serviceName": p.get("serviceName") or "", "segments": p.get("segments") or [],
                                  "endDate": p.get("serviceEndDate") or ""} for p in running]},
        "expired": {"expired": expired, "hasService": bool(current),
                    "endDate": (latest or {}).get("serviceEndDate") or "", "expiredAt": (latest or {}).get("expiredAt") or ""},
    }


def find_client(kind: str, value: str) -> Optional[dict]:
    leads = [d for d in _records("leads", kind, value) if isinstance(d.get("clientInfo"), dict) and d["clientInfo"]]
    sales = _records("sales", kind, value)
    sale_ids = {s.get("id") for s in sales if s.get("id")}
    esigns = _with_sales("eSignRecords", _records("eSignRecords", kind, value), sale_ids)
    paid = _with_sales("paidClients", _records("paidClients", kind, value), sale_ids)
    reviews = _records(REVIEWS, kind, value)
    submissions = _submissions(sales, leads)
    if not (submissions or esigns or paid or reviews):
        return None
    pans = [_pan(i.get("panNumber")) for d in (*sales, *leads, *esigns, *paid, *reviews) for i in _infos(d)]
    pan = next((p for p in pans if PAN_RE.fullmatch(p)), "")
    return {
        "query": {"kind": kind, "value": value},
        # Grievances follow the client's PAN when known, so a mobile search finds the same files
        "clientKey": f"PAN:{pan}" if pan else f"MOBILE:{value}",
        "client": submissions[0]["details"] if submissions else _clean((paid or esigns or [{}])[0]),
        "submissions": submissions,
        "leegality": _signings(sales, esigns, paid),
        "invoices": _invoices(reviews),
        "status": client_status(sales, paid, pan),
    }


@router.get("/search")
def search(q: str = Query(..., max_length=30), current_user: dict = Depends(require_access)):
    kind, value = parse_query(q)
    found = find_client(kind, value)
    if not found:
        label = "PAN" if kind == "PAN" else "mobile number"
        raise HTTPException(status_code=404, detail=f"No client with {label} {value} is on file.")
    return found


# ==========================================
# Invoices
# ==========================================
def _attachment(name: str) -> dict:
    # ASCII fallback plus the UTF-8 name (RFC 6266), so a renamed file with any characters still downloads
    ascii_name = name.encode("ascii", "replace").decode("ascii").replace("?", "_")
    return {"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"}


@router.get("/invoices/{review_id}/pdf")
def download_invoice(review_id: str, current_user: dict = Depends(require_access)):
    review = store.get(REVIEWS, review_id) if re.fullmatch(r"[0-9a-f]{64}", review_id or "") else None
    if not review or review.get("status") != "approved" or not review.get("invoiceNumber"):
        raise HTTPException(status_code=404, detail="Invoice not found.")
    saved = store.get(INVOICE_PDFS, review_id)
    if saved and saved.get("data"):
        pdf = base64.b64decode(saved["data"])
    else:
        # Emailed before copies were kept: rebuild it from the same details, number and date
        issued = datetime.fromisoformat(review.get("decidedAt") or datetime.now(timezone.utc).isoformat())
        pdf = invoice.build_pdf(review.get("details") or {}, review["invoiceNumber"], issued)
    name = review.get("invoiceFile") or f"Invoice {review['invoiceNumber'].replace('/', '-')}.pdf"
    return Response(content=pdf, media_type="application/pdf", headers=_attachment(_safe_name(name)))


# ==========================================
# Grievances
# ==========================================
def _safe_name(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", " ".join(str(name or "").split())).strip(" .")
    return name[:MAX_NAME_CHARS]


def _extension(name: str) -> str:
    match = re.search(r"\.[A-Za-z0-9]{1,8}$", name or "")
    return match.group(0) if match else ""


def _client_key(key: str) -> str:
    """A key returned by the search ('PAN:...' / 'MOBILE:...') of a client that is on file."""
    key = (key or "").strip().upper()
    match = KEY_RE.fullmatch(key)
    if not match:
        raise HTTPException(status_code=400, detail="Search for the client first.")
    kind, value = (match.group(1), match.group(2)) if match.group(1) else (match.group(3), match.group(4))
    if not find_client(kind, value):
        raise HTTPException(status_code=404, detail="That client is no longer on file.")
    return key


def _today() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def _view(meta: dict) -> dict:
    return {k: meta.get(k) for k in ("id", "fileName", "contentType", "size", "uploadedAt", "uploadDate",
                                     "uploadedBy", "renamedBy", "renamedAt")}


def _for_client(key: str) -> list:
    return [g for g in store.containing(GRIEVANCES, key) if g.get("clientKey") == key]


class GrievanceUpload(BaseModel):
    clientKey: str
    fileName: str
    contentType: Optional[str] = ""
    dataBase64: str


class GrievanceRename(BaseModel):
    fileName: str


@router.get("/grievances")
def list_grievances(clientKey: str = Query(..., max_length=30), dateFrom: str = Query("", alias="from", max_length=10),
                    dateTo: str = Query("", alias="to", max_length=10), current_user: dict = Depends(require_access)):
    key = _client_key(clientKey)
    for value in (dateFrom, dateTo):
        if value and not DATE_RE.fullmatch(value):
            raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD.")
    if dateFrom and dateTo and dateFrom > dateTo:
        raise HTTPException(status_code=400, detail="The From date is after the To date.")
    files = _for_client(key)
    today = _today()
    shown = [g for g in files if (not dateFrom or g["uploadDate"] >= dateFrom) and (not dateTo or g["uploadDate"] <= dateTo)]
    shown.sort(key=lambda g: g["uploadedAt"], reverse=True)
    return {"files": [_view(g) for g in shown], "total": len(files),
            "uploadedToday": sum(1 for g in files if g["uploadDate"] == today),
            "maxPerDay": MAX_FILES_PER_DAY, "maxFileBytes": MAX_FILE_BYTES, "today": today}


@router.post("/grievances")
def upload_grievance(req: GrievanceUpload, current_user: dict = Depends(require_access)):
    key = _client_key(req.clientKey)
    name = _safe_name(req.fileName)
    if not name:
        raise HTTPException(status_code=400, detail="The file needs a name.")
    raw = (req.dataBase64 or "").strip()
    if len(raw) > (MAX_FILE_BYTES * 4) // 3 + 8:
        raise HTTPException(status_code=413, detail=f"Each file can be at most {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    try:
        content = base64.b64decode(raw, validate=True)
    except ValueError:
        raise HTTPException(status_code=400, detail="The file could not be read (invalid base64).")
    if not content:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"Each file can be at most {MAX_FILE_BYTES // (1024 * 1024)} MB.")

    now = datetime.now(timezone.utc)
    today = now.astimezone(IST).strftime("%Y-%m-%d")
    file_id = f"grv-{secrets.token_hex(12)}"
    meta = {"id": file_id, "clientKey": key, "fileName": name, "contentType": (req.contentType or "")[:100],
            "size": len(content), "uploadedAt": now.isoformat(), "uploadDate": today,
            "uploadedBy": current_user.get("name") or "", "uploadedById": current_user["id"]}
    # Counted and written in one transaction (it holds the write lock), so two uploads at once cannot both be the 10th
    with store.transaction():
        if sum(1 for g in _for_client(key) if g["uploadDate"] == today) >= MAX_FILES_PER_DAY:
            raise HTTPException(status_code=429, detail=f"{MAX_FILES_PER_DAY} grievance files have already been uploaded for this client today. Upload more tomorrow.")
        store.put(GRIEVANCE_FILES, file_id, {"id": file_id, "data": base64.b64encode(content).decode("ascii")})
        store.put(GRIEVANCES, file_id, meta)
    return _view(meta)


def _grievance_or_404(file_id: str) -> dict:
    meta = store.get(GRIEVANCES, file_id) if re.fullmatch(r"grv-[0-9a-f]{24}", file_id or "") else None
    if not meta:
        raise HTTPException(status_code=404, detail="Grievance file not found.")
    return meta


@router.patch("/grievances/{file_id}")
def rename_grievance(file_id: str, req: GrievanceRename, current_user: dict = Depends(require_access)):
    with store.transaction():
        meta = _grievance_or_404(file_id)
        name = _safe_name(req.fileName)
        if not name:
            raise HTTPException(status_code=400, detail="Enter a file name.")
        ext = _extension(meta["fileName"])
        if ext and _extension(name).lower() != ext.lower():
            name = _safe_name(name + ext)  # keep the file type, so it still opens after download
        meta.update(fileName=name, renamedBy=current_user.get("name") or "", renamedAt=datetime.now(timezone.utc).isoformat())
        store.put(GRIEVANCES, file_id, meta)
    return _view(meta)


@router.get("/grievances/{file_id}/file")
def download_grievance(file_id: str, current_user: dict = Depends(require_access)):
    meta = _grievance_or_404(file_id)
    stored = store.get(GRIEVANCE_FILES, file_id) or {}
    if not stored.get("data"):
        raise HTTPException(status_code=500, detail=f"The contents of {meta['fileName']} are missing.")
    return Response(content=base64.b64decode(stored["data"]), media_type=meta.get("contentType") or "application/octet-stream",
                    headers=_attachment(meta["fileName"]))
