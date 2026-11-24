"""Extended Service Block: reward clients whose paid Net Value over the last 12 months crossed a limit.

The user enters a Net Value Limit (Rs). Every client whose closed sales (in the Paid block: E-Signed &
Converted, or an Old Client approved) add up to more than that in Net Sales, by Payment Date over the
last 12 months, is listed with the date they e-signed. A client is one PAN (or, without a PAN, one
mobile number), so all their payments count together.

"Assign" gives the client a service from the Service Master. In one step it:
  1. puts the service live: a new Paid block record (so it shows in Paid and the Telegram Control
     Block with the service's segments ticked), starting today and ending with the client's current
     e-Sign-based service period (or, when that is over, one tenure from today);
  2. generates the tax invoice at the service's Value (Rs) in the Service Master (GST included, as on
     every other invoice), numbered in the client's branch series;
  3. emails the invoice to the client from the Email Block's Sender Email ID. A failed email is kept in
     the Email Block's failure report and can be retried here.

Who may use it is the "extended-service" feature in the Feature Access Block (Super Admin by default),
checked on every request.
"""
import base64
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

try:
    from backend import store, invoice, email_kit, salary
    from backend.auth import get_current_user
except ImportError:
    import store
    import invoice
    import email_kit
    import salary
    from auth import get_current_user


FEATURE_ID = "extended-service"
DEFAULT_ROLES = ("Super Admin",)  # kept in step with CRM_FEATURES in CRMContext.jsx
ASSIGNMENTS = "extendedServiceAssignments"   # server-only: one per assigned service
FILES = "extendedServiceInvoiceFiles"        # server-only: the invoice PDF, apart so listing never loads it
SETTINGS = "extendedServiceSettings"         # {"limit": last Net Value Limit used}
WINDOW_DAYS = 365
MAX_LIMIT = 1_000_000_000
ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
KEY_RE = re.compile(r"^(pan|phone):[A-Z0-9]{1,20}$")
PAID_ACTIVE, PAID_EXPIRED = "Active", "Service Expired"

# Telegram Control Block segments ticked for a service (mirrors SERVICE_SEGMENTS in serviceTenure.js)
SERVICE_SEGMENTS = {
    "stock cash": ["NSE BSE Equity"], "stock future": ["NSE DERIVATIVES"], "stock options": ["NSE DERIVATIVES"],
    "index futures": ["NSE DERIVATIVES"], "index options": ["NSE DERIVATIVES"], "nse derivatives": ["NSE DERIVATIVES"],
    "bullions": ["MCX DERIVATIVES"], "base metals": ["MCX DERIVATIVES"], "energy": ["MCX DERIVATIVES"],
    "mcx derivatives": ["MCX DERIVATIVES"], "bse derivatives": ["BSE DERIVATIVES"],
    "hni options - nse & bse": ["NSE DERIVATIVES", "BSE DERIVATIVES"],
}

router = APIRouter(prefix="/api/extended-service", tags=["extended-service"])


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
        raise HTTPException(status_code=403, detail="You do not have access to the Extended Service Block.")
    return current_user


# ==========================================
# Dates
# ==========================================
def today_ist() -> date:
    return datetime.now(invoice.IST).date()


def _day(value) -> Optional[date]:
    """A date from YYYY-MM-DD / ISO timestamps / DD-MM-YYYY (Leegality), else None."""
    text = str(value or "").strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        try:
            return date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            return None
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", text)
    if m:
        try:
            return date(int(m[3]), int(m[2]), int(m[1]))
        except ValueError:
            return None
    return None


def _service_end(start: date, tenure) -> Optional[date]:
    """End date (first day no longer running) of a tenure, like computeServiceEndDate in serviceTenure.js."""
    end = invoice.due_date(start, tenure)
    return end + timedelta(days=1) if end else None


# ==========================================
# Qualifying clients
# ==========================================
def _info(sale: dict) -> dict:
    return salary._info(sale)


def client_key(details: dict, sale: Optional[dict] = None) -> str:
    pan = re.sub(r"[^A-Za-z0-9]", "", str(details.get("panNumber") or (sale or {}).get("panNumber") or "")).upper()
    if pan:
        return f"pan:{pan[:20]}"
    phone = "".join(ch for ch in str(details.get("phone1") or (sale or {}).get("phone1") or "") if ch.isdigit())[-10:]
    return f"phone:{phone}" if phone else ""


def _paid_by_sale() -> dict:
    return {p["saleId"]: p for p in store.all("paidClients") if p.get("saleId")}


def _esign_date(sale: dict, paid: Optional[dict]) -> str:
    for value in ((paid or {}).get("eSignedAt"), (paid or {}).get("serviceStartDate"), sale.get("eSignedAt"),
                  ((sale.get("eSignDetails") or {}).get("signedAt"))):
        day = _day(value)
        if day:
            return day.isoformat()
    return ""


def qualifying(limit: float, today: Optional[date] = None) -> dict:
    """Every client and their 12-month paid Net Value; `clients` only those above `limit`."""
    today = today or today_ist()
    since = today - timedelta(days=WINDOW_DAYS)
    paid_by_sale = _paid_by_sale()
    clients = {}
    for sale in salary.closed_sales(set(paid_by_sale)):
        info = _info(sale)
        key = client_key(info, sale)
        day = _day(salary.payment_date(sale))
        if not key or not day or not (since <= day <= today):
            continue
        net = salary._num(sale.get("netSales") if sale.get("netSales") not in (None, "") else info.get("netSales"))
        c = clients.setdefault(key, {"clientKey": key, "netValue": 0.0, "sales": [], "eSignDate": "", "latest": None})
        c["netValue"] += max(net, 0.0)
        paid = paid_by_sale.get(sale.get("id"))
        c["sales"].append({"saleId": sale.get("id"), "paymentDate": day.isoformat(), "netSales": round(net, 2),
                           "serviceName": info.get("serviceName") or sale.get("serviceOpted") or "",
                           "eSignDate": _esign_date(sale, paid)})
        if c["latest"] is None or day.isoformat() >= c["latest"][0]:
            c["latest"] = (day.isoformat(), sale)

    assigned = {}
    for a in store.all(ASSIGNMENTS):
        assigned.setdefault(a.get("clientKey"), []).append(_view(a))

    rows = []
    for c in clients.values():
        _, sale = c.pop("latest")
        info = _info(sale)
        c["netValue"] = round(c["netValue"], 2)
        if c["netValue"] <= limit:
            continue
        c["sales"].sort(key=lambda s: s["paymentDate"])
        signed = sorted(s["eSignDate"] for s in c["sales"] if s["eSignDate"])
        rows.append({
            **c,
            "clientName": " ".join(x for x in (info.get("clientPrefix"), info.get("clientName") or sale.get("clientName")) if x),
            "panNumber": info.get("panNumber") or sale.get("panNumber") or "",
            "phone": info.get("phone1") or sale.get("phone1") or "",
            "email": info.get("email") or sale.get("email") or "",
            "latestSaleId": sale.get("id"),
            # The latest e-Sign is what the client's current service runs from
            "eSignDate": signed[-1] if signed else "",
            "firstESignDate": signed[0] if signed else "",
            "assignments": sorted(assigned.get(c["clientKey"], []), key=lambda a: a["assignedAt"], reverse=True),
        })
    rows.sort(key=lambda r: r["netValue"], reverse=True)
    return {"limit": limit, "from": since.isoformat(), "to": today.isoformat(), "clients": rows}


def _view(a: dict) -> dict:
    return {k: a.get(k) for k in ("id", "clientKey", "clientName", "serviceName", "serviceTenure", "value", "invoiceNumber",
                                  "issuedAt", "total", "paidId", "serviceStartDate", "serviceEndDate", "emailStatus",
                                  "emailedTo", "emailedAt", "emailError", "assignedBy", "assignedAt")}


@router.get("")
def overview(limit: Optional[float] = Query(None, ge=0, le=MAX_LIMIT), current_user: dict = Depends(require_access)):
    saved = store.get_value(SETTINGS, {}) or {}
    if limit is None:
        limit = float(saved.get("limit") or 0)
    elif float(saved.get("limit") or -1) != limit:
        store.set_value(SETTINGS, {"limit": limit, "by": current_user.get("name") or ""})
    return qualifying(limit)


# ==========================================
# Assigning a service
# ==========================================
class Assign(BaseModel):
    clientKey: str = Field(..., max_length=30)
    serviceId: str = Field(..., max_length=80)
    limit: float = Field(..., ge=0, le=MAX_LIMIT)


def _service(service_id: str) -> dict:
    found = store.get("services", service_id) if ID_RE.fullmatch(service_id or "") else None
    if not found or not str(found.get("name") or "").strip():
        raise HTTPException(status_code=404, detail="That service is not in the Service Master.")
    value = invoice.amount(found.get("value"))
    if value <= 0:
        raise HTTPException(status_code=400, detail=f"Set a Value (₹) for '{found['name']}' in the Service Master first; "
                                                    "the invoice is issued at that value.")
    return {**found, "value": value}


def _current_paid(key: str, today: date) -> Optional[dict]:
    """The client's Paid record running longest from today (any service), or the latest one."""
    mine = []
    for p in store.all("paidClients"):
        if client_key({"panNumber": p.get("panNumber"), "phone1": p.get("phone")}) == key:
            mine.append(p)
    running = [p for p in mine if p.get("serviceEndDate") and p["serviceEndDate"] > today.isoformat()]
    pool = running or mine
    return max(pool, key=lambda p: (p.get("serviceEndDate") or "", p.get("serviceStartDate") or "")) if pool else None


def _segments(service_name: str) -> list:
    return list(SERVICE_SEGMENTS.get(" ".join(str(service_name or "").split()).lower(), []))


def _paid_record(sale: dict, details: dict, service: dict, current: Optional[dict], today: date, who: str) -> dict:
    tenure = (current or {}).get("serviceTenure") or details.get("serviceTenure") or ""
    if current and current.get("serviceEndDate") and current["serviceEndDate"] > today.isoformat():
        end = current["serviceEndDate"]
    else:
        computed = _service_end(today, tenure)
        end = computed.isoformat() if computed else None
    return {
        "id": "paid-ext-" + uuid.uuid4().hex[:12],
        "saleId": None,
        "extendedFromSaleId": sale.get("id"),
        "extendedService": True,
        "leadId": sale.get("leadId"),
        "documentId": (current or {}).get("documentId") or sale.get("eSignDocumentId") or "",
        "clientPrefix": details.get("clientPrefix") or "",
        "clientName": details.get("clientName") or sale.get("clientName") or "",
        "firmName": details.get("firmName") or "",
        "phone": details.get("phone1") or sale.get("phone1") or "",
        "email": details.get("email") or sale.get("email") or "",
        "panNumber": details.get("panNumber") or sale.get("panNumber") or "",
        "clientState": details.get("clientState") or "",
        "serviceName": service["name"].strip(),
        "serviceTenure": tenure or "Unspecified Tenure",
        "segments": _segments(service["name"]),
        "grossSales": "₹" + invoice.grouped(service["value"]),
        "paymentDate": today.isoformat(),
        "submittedByUserId": sale.get("submittedByUserId"),
        "submittedBy": sale.get("employeeName") or "",
        "eSignedAt": (current or {}).get("eSignedAt") or sale.get("eSignedAt") or "",
        "serviceStartDate": today.isoformat(),
        "serviceEndDate": end,
        "status": PAID_ACTIVE,
        "expiredAt": None,
        "assignedBy": who,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


def _invoice_details(details: dict, service: dict, tenure: str) -> dict:
    d = {k: details.get(k) for k in ("clientCategory", "clientPrefix", "clientName", "firmName", "gstin", "clientState",
                                     "panNumber", "email", "phone1")}
    # The Service Master Value is what the client pays, GST included (as Invoice 2 compares it with Gross Sales)
    return {**d, "serviceName": service["name"].strip(), "serviceTenure": tenure, "grossSales": service["value"],
            "netSales": "", "gst": ""}


def _email(record: dict, pdf: bytes) -> dict:
    settings = email_kit._settings()
    email_kit._require_sender(settings)
    d = record["details"]
    to = str(d.get("email") or "").strip()
    if not email_kit.EMAIL_RE.match(to):
        raise HTTPException(status_code=400, detail="No valid Email ID on the client's Client Information Page.")
    company = email_kit._company_name()
    name = " ".join(x for x in (d.get("clientPrefix"), d.get("clientName")) if x) or "Client"
    service = " ".join(x for x in (d.get("serviceName"), f"({d['serviceTenure']})" if d.get("serviceTenure") else "") if x)
    until = record.get("serviceEndDate")
    validity = f"The service runs until {date.fromisoformat(until).strftime('%d %b %Y')}.\n\n" if until else ""
    body = (f"Dear {name},\n\n"
            f"Thank you for being a valued client of {company}. As part of our Extended Service, {service} has been "
            f"added to your account. Please find attached invoice {record['invoiceNumber']}.\n\n"
            f"Invoice amount: {invoice.rupees(record['total'])} (including GST).\n\n"
            f"{validity}"
            f"If you have any questions, simply reply to this email.\n\nWarm regards,\n{company}")
    msg = email_kit._message(settings, to, f"Invoice {record['invoiceNumber']} from {company}", body)
    msg.add_attachment(pdf, maintype="application", subtype="pdf",
                       filename=f"Invoice {record['invoiceNumber'].replace('/', '-')}.pdf")
    email_kit._smtp_send(settings, msg)
    return {"to": to, "from": settings["senderEmail"], **email_kit._save_to_sent(settings, msg)}


def _send(record: dict, who: str) -> dict:
    """Email the invoice and record the outcome on the assignment (and in the Email Block on failure)."""
    stored = store.get(FILES, record["id"]) or {}
    pdf = base64.b64decode(stored.get("data") or "")
    now = datetime.now(timezone.utc).isoformat()
    try:
        sent = _email(record, pdf)
        patch = {"emailStatus": "sent", "emailedTo": sent["to"], "emailedFrom": sent["from"], "emailedAt": now,
                 "emailError": None}
    except Exception as err:  # noqa: BLE001 - the service and invoice stand; the email can be retried
        detail = err.detail if isinstance(err, HTTPException) else f"{type(err).__name__}: {err}"
        d = record["details"]
        email_kit.record_failure("Extended Service Invoice", record.get("clientName") or "", d.get("email") or "", detail,
                                 by=who, assignmentId=record["id"], invoiceNumber=record["invoiceNumber"])
        patch = {"emailStatus": "failed", "emailError": str(detail), "emailTriedAt": now}
    with store.transaction():
        current = store.get(ASSIGNMENTS, record["id"]) or record
        current.update(patch)
        store.put(ASSIGNMENTS, current["id"], current)
    return current


@router.post("/assign")
def assign(req: Assign, current_user: dict = Depends(require_access)):
    if not KEY_RE.fullmatch(req.clientKey or ""):
        raise HTTPException(status_code=404, detail="Client not found.")
    client = next((c for c in qualifying(req.limit)["clients"] if c["clientKey"] == req.clientKey), None)
    if not client:
        raise HTTPException(status_code=404, detail="This client's paid Net Value over the last 12 months is not above the limit.")
    service = _service(req.serviceId)
    sale = store.get("sales", client["latestSaleId"]) or {}
    details = _info(sale)
    today = today_ist()
    who = current_user.get("name") or current_user.get("email") or ""
    current = _current_paid(req.clientKey, today)
    paid = _paid_record(sale, details, service, current, today, who)
    inv_details = _invoice_details(details, service, paid["serviceTenure"])
    branch, _ = invoice.branch_code_for(sale.get("submittedByUserId"))
    now = datetime.now(timezone.utc)
    assignment_id = "ext-" + uuid.uuid4().hex[:16]
    with store.transaction():
        number = invoice.next_number(branch, now, source=f"extended-service:{assignment_id}")
        pdf = invoice.build_pdf(inv_details, number, now, 1, service["value"])
        f = invoice.figures(inv_details, invoice._company()["state"], service["value"])
        store.put("paidClients", paid["id"], paid)
        record = {
            "id": assignment_id, "clientKey": req.clientKey, "clientName": client["clientName"],
            "serviceId": service["id"], "serviceName": paid["serviceName"], "serviceTenure": paid["serviceTenure"],
            "value": service["value"], "invoiceNumber": number, "issuedAt": now.isoformat(), "total": f["total"],
            "branchCode": branch, "paidId": paid["id"], "serviceStartDate": paid["serviceStartDate"],
            "serviceEndDate": paid["serviceEndDate"], "baseSaleId": sale.get("id"), "netValueAtAssign": client["netValue"],
            "limitAtAssign": req.limit, "details": inv_details, "emailStatus": "sending",
            "assignedBy": who, "assignedById": current_user["id"], "assignedAt": now.isoformat(),
        }
        store.put(ASSIGNMENTS, assignment_id, record)
        store.put(FILES, assignment_id, {"id": assignment_id, "data": base64.b64encode(pdf).decode("ascii")})
    return _view(_send(record, who))


@router.post("/assignments/{assignment_id}/resend")
def resend(assignment_id: str, current_user: dict = Depends(require_access)):
    record = store.get(ASSIGNMENTS, assignment_id) if ID_RE.fullmatch(assignment_id or "") else None
    if not record:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return _view(_send(record, current_user.get("name") or ""))


@router.get("/assignments/{assignment_id}/pdf")
def download(assignment_id: str, current_user: dict = Depends(require_access)):
    record = store.get(ASSIGNMENTS, assignment_id) if ID_RE.fullmatch(assignment_id or "") else None
    stored = store.get(FILES, assignment_id) if record else None
    if not stored or not stored.get("data"):
        raise HTTPException(status_code=404, detail="Invoice not found.")
    name = f"Invoice {record['invoiceNumber'].replace('/', '-')}.pdf"
    return Response(content=base64.b64decode(stored["data"]), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


def sent_log() -> list:
    """Every Extended Service invoice email, for the Email Block's consolidated report."""
    return [a for a in store.all(ASSIGNMENTS) if a.get("emailStatus") == "sent"]
