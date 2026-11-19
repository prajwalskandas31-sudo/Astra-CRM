"""Invoice Block: tax invoices for every client who has e-signed.

Lists the e-signed clients (E-Sign Block records, plus sales marked e-signed), what each paid against
the service's Value (Rs) in the Service Master, and whether Invoice 1 or Invoice 2 (paid less than the
Value: shows the Balance Due) is recommended. "Generate Invoice" issues the next number of the
submitter's branch for this month and keeps the PDF, so it can be downloaded again. Generating again
re-issues the same number and date with the current details (no gaps in the series).

Invoice Controls: GST / IGST / CGST / SGST percentages, the Notes and Terms & Conditions printed on the
invoice (Claude can draft them, using the CRM's own ANTHROPIC_API_KEY), the default Branch ID and each
branch's next number this month.

Who may use it is the "invoice-block" feature in the Feature Access Block (Super Admin by default),
checked on every request.
"""
import base64
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

try:
    from backend import store, invoice, reports
    from backend.auth import get_current_user
except ImportError:
    import store
    import invoice
    import reports
    from auth import get_current_user


FEATURE_ID = "invoice-block"
DEFAULT_ROLES = ("Super Admin",)  # kept in step with CRM_FEATURES in CRMContext.jsx
INVOICES = "clientInvoices"       # server-only, by sale id: number, kind, date, amounts
INVOICE_FILES = "clientInvoiceFiles"  # server-only, by sale id: the PDF (apart, so listing never loads it)
MAX_TEXT = 3000
SALE_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")

router = APIRouter(prefix="/api/invoice-block", tags=["invoice-block"])


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
        raise HTTPException(status_code=403, detail="You do not have access to the Invoice Block.")
    return current_user


# ==========================================
# E-signed clients
# ==========================================
DETAIL_KEYS = ("clientCategory", "clientPrefix", "clientName", "firmName", "gstin", "clientState", "panNumber",
               "email", "phone1", "serviceName", "serviceTenure", "grossSales", "netSales", "gst", "paymentDate",
               "serviceValue")


def _details(sale: Optional[dict], record: Optional[dict]) -> dict:
    """The Client Information Page as submitted (the sale's copy), filled in from the e-sign record."""
    sale, record = sale or {}, record or {}
    info = sale.get("fullClientInfo") if isinstance(sale.get("fullClientInfo"), dict) else {}
    flat = {"serviceName": sale.get("serviceOpted"), **{k: sale.get(k) for k in DETAIL_KEYS}}
    out = {}
    for key in DETAIL_KEYS:
        for source in (info, flat, record):
            if source.get(key) not in (None, ""):
                out[key] = source[key]
                break
    return out


def _esigned() -> list:
    """(sale id, sale, e-sign record, signed at), one per sale, for every client who has e-signed."""
    found = {}
    for r in store.all("eSignRecords"):
        sale_id = r.get("saleId")
        if sale_id and sale_id not in found:
            found[sale_id] = (store.get("sales", sale_id), r, r.get("confirmedAt") or "")
    for s in store.containing("sales", "Completed"):
        if s.get("eSignStatus") == "Completed" and s.get("id") and s["id"] not in found:
            found[s["id"]] = (s, None, s.get("eSignedAt") or "")
    return [(sale_id, *rest) for sale_id, rest in found.items()]


def _branch(sale: Optional[dict]) -> dict:
    code, source = invoice.branch_code_for((sale or {}).get("submittedByUserId"))
    return {"code": code, "source": source}


def _row(sale_id: str, sale: Optional[dict], record: Optional[dict], signed_at: str, company_state: str, cfg: dict) -> dict:
    d = _details(sale, record)
    value = invoice.service_value(d.get("serviceName"))
    value_from = "serviceMaster"
    if value is None and invoice.amount(d.get("serviceValue")) > 0:
        value, value_from = invoice.amount(d.get("serviceValue")), "clientInformation"
    f = invoice.figures(d, company_state, value, cfg)
    name, gstin = invoice.bill_to(d)
    saved = store.get(INVOICES, sale_id)
    return {
        "saleId": sale_id, "signedAt": signed_at, "documentId": (record or {}).get("documentId") or (sale or {}).get("eSignDocumentId") or "",
        "clientName": " ".join(x for x in (d.get("clientPrefix"), d.get("clientName")) if x), "billTo": name,
        "clientCategory": d.get("clientCategory") or "Individual", "firmName": d.get("firmName") or "", "gstin": gstin,
        "clientState": d.get("clientState") or "", "panNumber": d.get("panNumber") or "",
        "serviceName": d.get("serviceName") or "", "serviceTenure": d.get("serviceTenure") or "",
        "submittedBy": (sale or {}).get("employeeName") or "", "branch": _branch(sale),
        "grossSales": f["gross"], "netSales": f["net"], "taxes": f["taxes"], "total": f["total"],
        "serviceValue": f["serviceValue"], "serviceValueFrom": value_from if value is not None else "",
        "balance": f["balance"], "recommended": f["recommended"],
        "invoice": _view(saved) if saved else None,
    }


def _view(saved: dict) -> dict:
    return {k: saved.get(k) for k in ("number", "kind", "issuedAt", "generatedBy", "reissuedAt", "reissuedBy", "total", "balance")}


def _find(sale_id: str) -> tuple:
    if not SALE_ID_RE.fullmatch(sale_id or ""):
        raise HTTPException(status_code=404, detail="Client not found.")
    for row in _esigned():
        if row[0] == sale_id:
            return row
    raise HTTPException(status_code=404, detail="This client has not e-signed, so no invoice can be generated.")


@router.get("")
def overview(current_user: dict = Depends(require_access)):
    cfg = invoice.settings()
    company = invoice._company()
    rows = [_row(*r, company["state"], cfg) for r in _esigned()]
    rows.sort(key=lambda r: str(r["signedAt"] or ""), reverse=True)
    return {"rows": rows, "settings": cfg, "branches": _branches(), "company": {
        "state": company["state"], "gstin": company["gstin"], "name": company["companyName"],
        "hasLogo": bool(company["companyLogo"]), "logoIsSvg": company["companyLogo"].startswith("data:image/svg")}}


# ==========================================
# Generating
# ==========================================
class Generate(BaseModel):
    kind: int = Field(..., ge=1, le=2)


def _attachment(name: str) -> dict:
    ascii_name = name.encode("ascii", "replace").decode("ascii").replace("?", "_")
    return {"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"}


@router.post("/{sale_id}/generate")
def generate(sale_id: str, req: Generate, current_user: dict = Depends(require_access)):
    sale_id, sale, record, signed_at = _find(sale_id)
    cfg = invoice.settings()
    company = invoice._company()
    d = _details(sale, record)
    row = _row(sale_id, sale, record, signed_at, company["state"], cfg)
    if req.kind == 2 and not row["serviceValue"]:
        raise HTTPException(status_code=400, detail=f"Invoice 2 needs the Value (₹) of '{d.get('serviceName') or 'the service'}' "
                                                    "in the Service Master.")
    if not (row["netSales"] or row["grossSales"]):
        raise HTTPException(status_code=400, detail="The Client Information Page has no Net / Gross Sales for this client.")
    now = datetime.now(timezone.utc)
    who = current_user.get("name") or current_user.get("email") or ""
    with store.transaction():
        saved = store.get(INVOICES, sale_id)
        if saved:
            number, issued = saved["number"], datetime.fromisoformat(saved["issuedAt"])
        else:
            number = invoice.next_number(row["branch"]["code"], now, source=f"invoice-block:{sale_id}")
            issued = now
        pdf = invoice.build_pdf(d, number, issued, req.kind, row["serviceValue"], cfg)
        f = invoice.figures(d, company["state"], row["serviceValue"], cfg)
        doc = {**(saved or {}), "id": sale_id, "number": number, "kind": req.kind, "issuedAt": issued.isoformat(),
               "branchCode": (saved or {}).get("branchCode") or row["branch"]["code"], "total": f["total"],
               "balance": f["balance"] if req.kind == 2 else 0, "details": d}
        if saved:
            doc.update(reissuedAt=now.isoformat(), reissuedBy=who)
        else:
            doc.update(generatedBy=who, generatedById=current_user["id"])
        store.put(INVOICES, sale_id, doc)
        store.put(INVOICE_FILES, sale_id, {"id": sale_id, "data": base64.b64encode(pdf).decode("ascii")})
    return _view(doc)


@router.get("/{sale_id}/pdf")
def download(sale_id: str, current_user: dict = Depends(require_access)):
    saved = store.get(INVOICES, sale_id) if SALE_ID_RE.fullmatch(sale_id or "") else None
    stored = store.get(INVOICE_FILES, sale_id) if saved else None
    if not stored or not stored.get("data"):
        raise HTTPException(status_code=404, detail="No invoice has been generated for this client yet.")
    return Response(content=base64.b64decode(stored["data"]), media_type="application/pdf",
                    headers=_attachment(f"Invoice {saved['number']}.pdf"))


# ==========================================
# Invoice Controls
# ==========================================
class Controls(BaseModel):
    gstPercent: float = Field(..., ge=0, le=100)
    igstPercent: float = Field(..., ge=0, le=100)
    cgstPercent: float = Field(..., ge=0, le=100)
    sgstPercent: float = Field(..., ge=0, le=100)
    notes: str = Field("", max_length=MAX_TEXT)
    terms: str = Field("", max_length=MAX_TEXT)
    defaultBranchCode: str = Field("", max_length=20)


@router.put("/settings")
def save_settings(req: Controls, current_user: dict = Depends(require_access)):
    code = req.defaultBranchCode.strip().upper()
    if code and not invoice.BRANCH_RE.fullmatch(code):
        raise HTTPException(status_code=400, detail="The default Branch ID may only use letters, digits, - and _.")
    value = {**req.model_dump(), "defaultBranchCode": code,
             "notes": req.notes.strip(), "terms": req.terms.strip()}
    store.set_value(invoice.SETTINGS, value)
    return invoice.settings()


def _branches() -> list:
    codes = {}
    for b in store.all("branches"):
        code = str(b.get("branchCode") or "").strip().upper()
        if invoice.BRANCH_RE.fullmatch(code):
            codes[code] = b.get("name") or code
    cfg_code = str(invoice.settings().get("defaultBranchCode") or "").strip().upper()
    for code, label in ((cfg_code, "Default (Invoice Controls)"), (invoice.FALLBACK_BRANCH, "Fallback (no Branch ID)")):
        if code and code not in codes:
            codes[code] = label
    now = datetime.now(invoice.IST)
    return [{"code": c, "name": n, "nextNumber": invoice.upcoming_number(c, now),
             "nextInvoice": invoice.format_number(c, now, invoice.upcoming_number(c, now))} for c, n in sorted(codes.items())]


class Counter(BaseModel):
    branchCode: str = Field(..., max_length=20)
    nextNumber: int = Field(..., ge=1, le=99999)


@router.put("/counters")
def save_counter(req: Counter, current_user: dict = Depends(require_access)):
    code = req.branchCode.strip().upper()
    if not invoice.BRANCH_RE.fullmatch(code):
        raise HTTPException(status_code=400, detail="Unknown Branch ID.")
    now = datetime.now(invoice.IST)
    number = invoice.format_number(code, now, req.nextNumber)
    if store.get(invoice.NUMBERS, number):
        raise HTTPException(status_code=409, detail=f"{number} has already been issued. Pick a higher number.")
    invoice.set_upcoming_number(code, req.nextNumber, now)
    return {"branches": _branches()}


# ==========================================
# Claude drafts Notes / Terms & Conditions
# ==========================================
class DraftRequest(BaseModel):
    field: str = Field(..., pattern="^(notes|terms)$")
    instruction: str = Field("", max_length=500)
    current: str = Field("", max_length=MAX_TEXT)


class Draft(BaseModel):
    text: str


DRAFT_SYSTEM = """You write the short text printed at the bottom of a GST tax invoice issued by an Indian
SEBI-registered Research Analyst firm to its clients, for research / advisory subscriptions.

Rules:
- Plain text only. One point per line, each line starting with "* ". At most 8 lines, each under 200 characters.
- Factual and compliant with SEBI rules for Research Analysts: never promise or imply returns, profits or
  guaranteed performance; no amounts, dates, names, phone numbers or links unless they are in the current text.
- Keep every point of the current text that is still correct, unless the instruction says otherwise.
- "notes" are about the invoice and payment; "terms" are the Terms & Conditions / risk disclosures."""


@router.post("/draft-text")
def draft_text(req: DraftRequest, current_user: dict = Depends(require_access)):
    label = "Notes" if req.field == "notes" else "Terms & Conditions"
    prompt = (f"Section: {req.field} ({label})\n\n<current_text>\n{req.current.strip() or '(empty)'}\n</current_text>\n\n"
              f"<instruction>\n{req.instruction.strip() or 'Tidy the wording and fix any grammar; keep the meaning.'}\n</instruction>\n\n"
              f"Return the new {label} text.")
    try:
        result: Draft = reports.ask_claude(reports.settings(), DRAFT_SYSTEM, prompt, Draft, "low")
    except reports.ReportHeld as err:
        raise HTTPException(status_code=503, detail=str(err))
    lines = [line.rstrip() for line in result.text.strip().splitlines() if line.strip()]
    return {"text": "\n".join(lines)[:MAX_TEXT]}
