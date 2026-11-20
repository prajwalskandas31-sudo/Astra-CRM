"""Old Client submissions: Telegram review, then the invoice by email.

On the Client Information Page the executive picks New Client or Old Client. A New Client goes through
the usual Sale Approval, e-KYC & E-Sign and Welcome Kit. An Old Client gets none of that: "Send to
Review" posts every detail of the page to the same Client_information_page_updates group (same bot as
client_info_telegram), with a review link. Anyone who has the link can open it, without signing in to
the CRM, and Approve or Decline. Approving emails the client only the invoice (PDF), from the Email
Block's Sender Email ID; declining sends the sale back to the executive.

The link carries a random token; only its SHA-256 is stored, and it is never returned to the executive
who submitted, so they cannot approve their own sale. The details the reviewer sees and the address the
invoice goes to are the server's copy taken at submission, not anything sent with the decision.
"""
import base64
import hashlib
import html
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

try:
    from backend import store, invoice, email_kit
    from backend import client_info_telegram as cit
    from backend.auth import get_current_user
except ImportError:
    import store
    import invoice
    import email_kit
    import client_info_telegram as cit
    from auth import get_current_user


REVIEWS = "oldClientReviews"  # server-only collection (not in sync.POLICIES, so never sent to browsers)
INVOICE_PDFS = "invoicePdfs"  # server-only: the exact invoice PDF emailed, by review id (Client Master downloads it)
IST = timezone(timedelta(hours=5, minutes=30))
SENDING_TIMEOUT = timedelta(minutes=5)  # a crashed "sending" claim can be retried after this
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,100}$")

# Sale statuses (kept in step with CRMContext.jsx, SaleApprovalWorkflow.jsx and sync.py)
CLIENT_TYPE = "Old Client"
STATUS_AWAITING = "Old Client - Awaiting Approval"
STAGE_AWAITING = "Awaiting Telegram Approval (Old Client)"
STATUS_APPROVED = "Old Client - Approved"
STAGE_APPROVED = "Invoice Emailed"
STATUS_DECLINED = "Old Client - Declined"
STAGE_DECLINED = "Declined in Telegram Review"

DETAIL_FIELDS = ("panNumber", "clientCategory", "clientPrefix", "clientName", "firmName", "gstin", "gstCertificateFile",
                 "email", "phone1", "phone2", "clientState", "paymentDate", "serviceName", "serviceTenure",
                 "serviceEndDate", "expiryInherited", "transactionNumbers", "grossSales", "netSales", "gst")

log = logging.getLogger("old_client_review")
router = APIRouter(prefix="/api/client-info/old-client", tags=["old-client-review"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def review_link(base: str, token: str) -> str:
    return f"{base.rstrip('/')}/api/client-info/old-client/review/{token}"


def _clean_details(details: dict) -> dict:
    out = {}
    for key in DETAIL_FIELDS:
        value = (details or {}).get(key)
        if key == "expiryInherited":  # the expiry is the client's active subscription's own
            out[key] = value is True
        elif isinstance(value, list):
            out[key] = [cit._text(v)[:200] for v in value if cit._text(v)][:10]
        else:
            out[key] = cit._text(value)[:500]
    return out


# ==========================================
# Submit (signed-in executive)
# ==========================================
def build_message(alert: cit.ClientInfoAlert, submitted_by: str, link: str) -> str:
    lines = ["🔁 <b>Old Client: Sent to Review</b>",
             "<i>No e-KYC and no Welcome Kit. Approving emails only the invoice to the client.</i>", "",
             *cit.detail_lines(alert), "", *cit.submission_lines(alert, submitted_by), "",
             "✅ <b>Approve / Decline</b>",
             f'<a href="{html.escape(link, quote=True)}">Review {cit._e(cit.client_name(alert.details or {}))}</a>',
             html.escape(link),
             "<i>Anyone with this link can approve or decline; no CRM sign-in is needed.</i>"]
    return cit.fit("\n".join(lines))


@router.post("")
def submit_old_client(alert: cit.ClientInfoAlert, current_user: dict = Depends(get_current_user)):
    cfg = cit.settings()
    if not cfg["token"]:
        raise HTTPException(status_code=503, detail="TELEGRAM_CLIENT_INFO_BOT_TOKEN is not set in backend/.env")
    sale_id = alert.saleId.strip()
    if not sale_id:
        raise HTTPException(status_code=400, detail="saleId is required")
    # The browser pushes the sale through sync a moment before or after this call, so it may not be here
    # yet; if it is, it must be this user's own Old Client sale awaiting approval. _update_crm checks again.
    existing = store.get("sales", sale_id)
    if existing and not _sale_matches(existing, alert.leadId or "", current_user.get("id")):
        raise HTTPException(status_code=403, detail="That sale is not your Old Client sale awaiting approval.")
    details = _clean_details(alert.details)
    if not email_kit.EMAIL_RE.match(details["email"]):
        raise HTTPException(status_code=400, detail=f"The client's Email ID '{details['email']}' is not a valid address.")
    alert = cit.ClientInfoAlert(saleId=sale_id, leadId=alert.leadId or "", details=details,
                                attachmentNames=[cit._text(n)[:200] for n in alert.attachmentNames][:10])

    token = secrets.token_urlsafe(32)
    link = review_link(cit._crm_base(cfg), token)
    submitted_by = current_user.get("name") or current_user.get("email") or "Executive"
    record = {
        "id": _hash(token), "saleId": sale_id, "leadId": alert.leadId, "details": details,
        "attachmentNames": alert.attachmentNames, "submittedBy": submitted_by, "submittedById": current_user.get("id"),
        "submittedAt": _now().isoformat(), "status": "pending",
    }
    try:
        chat_id = cit._chat_id(cfg)
        sent = cit._send(cfg, chat_id, build_message(alert, submitted_by, link), link, "✅ Approve / ❌ Decline")
    except cit.TelegramError as err:
        raise HTTPException(status_code=502, detail=f"Telegram: {err}") from None
    record["telegram"] = {"chatId": str((sent.get("chat") or {}).get("id") or chat_id), "messageId": sent.get("message_id")}
    store.put(REVIEWS, record["id"], record)
    # The link is deliberately not returned: the submitter must not be able to approve their own sale
    return {"ok": True, "messageId": sent.get("message_id")}


# ==========================================
# Review page (anyone with the link)
# ==========================================
def _record_or_404(token: str) -> dict:
    record = store.get(REVIEWS, _hash(token)) if TOKEN_RE.match(token or "") else None
    if not record:
        raise HTTPException(status_code=404, detail="This review link is not valid.")
    return record


PAGE_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
}

STYLE = """
:root{color-scheme:light dark;--bg:#f5f6fa;--card:#fff;--text:#111827;--muted:#6b7280;--line:#e5e7eb;--ok:#047857;--bad:#b91c1c;--accent:#4f46e5}
@media (prefers-color-scheme:dark){:root{--bg:#0b0d14;--card:#151824;--text:#e5e7eb;--muted:#9ca3af;--line:#262b3b;--ok:#34d399;--bad:#f87171;--accent:#818cf8}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:20px 16px 40px}h1{font-size:1.3rem;margin:0 0 4px}p.sub{color:var(--muted);margin:0 0 16px}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:14px}
h2{font-size:.95rem;margin:0 0 8px}table{width:100%;border-collapse:collapse}td{padding:5px 0;border-top:1px solid var(--line);vertical-align:top}
td:first-child{color:var(--muted);width:42%;padding-right:10px}tr:first-child td{border-top:0}
.status{font-weight:700;padding:10px 14px;border-radius:10px;margin-bottom:14px;border:1px solid var(--line);background:var(--card)}
.ok{color:var(--ok)}.bad{color:var(--bad)}label{display:block;font-weight:600;margin:8px 0 4px}
input,textarea{width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media (max-width:560px){.actions{grid-template-columns:1fr}}
button{margin-top:10px;width:100%;padding:11px;border:0;border-radius:9px;font:inherit;font-weight:700;color:#fff;cursor:pointer}
.approve{background:#059669}.decline{background:#dc2626}small{color:var(--muted)}
"""


def _rows(record: dict) -> list:
    d = record.get("details") or {}
    name = cit.client_name(d)
    rows = [("1. Client Identity & Category", [("PAN Number", d.get("panNumber")), ("Client Category", d.get("clientCategory")),
                                                ("Client Name", name)]
             + ([("Firm Name", d.get("firmName")), ("GSTIN", d.get("gstin")), ("GST Certificate", d.get("gstCertificateFile"))]
                if d.get("clientCategory") == "Non-Individual" else [])),
            ("2. Contact Information", [("Email ID", d.get("email")), ("Phone Number 1", d.get("phone1")),
                                        ("Phone Number 2", d.get("phone2")), ("Client State", d.get("clientState"))]),
            ("3. Service Subscription & Financials", [
                ("Payment Date", d.get("paymentDate")), ("Service Name", d.get("serviceName")),
                ("Service Tenure", d.get("serviceTenure")), ("Transaction No(s)", d.get("transactionNumbers")),
                ("Gross Sales", cit._rupees(d.get("grossSales"))), ("Net Sales", cit._rupees(d.get("netSales"))),
                ("GST", cit._rupees(d.get("gst"))),
                ("Transaction Attachments", ", ".join(record.get("attachmentNames") or []) or "—")]),
            ("Submission", [("Submitted by", record.get("submittedBy")), ("Submitted at", _ist(record.get("submittedAt"))),
                            ("Sale ID", record.get("saleId"))])]
    return rows


def _ist(iso: Optional[str]) -> str:
    try:
        return datetime.fromisoformat(iso).astimezone(IST).strftime("%d-%m-%Y %H:%M IST")
    except (TypeError, ValueError):
        return iso or ""


def _status_html(record: dict, error: str = "") -> str:
    e = html.escape
    status = record.get("status")
    if status == "approved":
        return (f'<div class="status ok">Approved by {e(record.get("decidedBy") or "")} on {e(_ist(record.get("decidedAt")))}. '
                f'Invoice {e(record.get("invoiceNumber") or "")} was emailed to {e(record.get("emailedTo") or "")}.</div>')
    if status == "declined":
        reason = record.get("declineReason")
        return (f'<div class="status bad">Declined by {e(record.get("decidedBy") or "")} on {e(_ist(record.get("decidedAt")))}.'
                + (f" Reason: {e(reason)}" if reason else "") + "</div>")
    if status == "sending":
        return '<div class="status">Approval in progress: the invoice is being emailed. Refresh this page in a minute.</div>'
    note = error or record.get("lastError")
    return f'<div class="status bad">Last approval attempt failed: {e(note)}</div>' if note else ""


def render_page(record: dict, token: str, error: str = "") -> str:
    e = html.escape
    d = record.get("details") or {}
    sections = []
    for title, rows in _rows(record):
        body = "".join(f"<tr><td>{e(label)}</td><td>{cit._e(value)}</td></tr>" for label, value in rows)
        sections.append(f"<section><h2>{e(title)}</h2><table>{body}</table></section>")
    actions = ""
    if record.get("status") == "pending":
        base = f"./{e(token)}"
        actions = f"""
<div class="actions">
  <section><h2 class="ok">Approve</h2><form method="post" action="{base}/approve">
    <label for="an">Your name</label><input id="an" name="reviewer" maxlength="80" required autocomplete="name">
    <small>Emails invoice to {e(d.get("email") or "")}. No e-KYC, no Welcome Kit.</small>
    <button class="approve" type="submit">Approve &amp; email invoice</button></form></section>
  <section><h2 class="bad">Decline</h2><form method="post" action="{base}/decline">
    <label for="dn">Your name</label><input id="dn" name="reviewer" maxlength="80" required autocomplete="name">
    <label for="dr">Reason (optional)</label><textarea id="dr" name="reason" rows="2" maxlength="500"></textarea>
    <button class="decline" type="submit">Decline</button></form></section>
</div>"""
    name = cit.client_name(d) or "Client"
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Old Client Review</title><style>{STYLE}</style></head><body><main>
<h1>Old Client Review: {e(name)}</h1><p class="sub">Client Information Page details. Approving emails only the invoice to the client.</p>
{_status_html(record, error)}{actions}{"".join(sections)}</main></body></html>"""


def _page(record: dict, token: str, error: str = "", status_code: int = 200) -> HTMLResponse:
    return HTMLResponse(render_page(record, token, error), status_code=status_code, headers=PAGE_HEADERS)


@router.get("/review/{token}", response_class=HTMLResponse)
def review_page(token: str):
    return _page(_record_or_404(token), token)


def _back(token: str) -> RedirectResponse:
    # Post/Redirect/Get, so a refresh never repeats a decision. Relative, because the browser sees the
    # address nginx serves (/review/<token>/approve -> ../<token>), whatever CRM_PUBLIC_URL is.
    return RedirectResponse(f"../{token}", status_code=303, headers=PAGE_HEADERS)


def _reviewer(name: str) -> str:
    name = " ".join((name or "").split())[:80]
    if not name:
        raise HTTPException(status_code=400, detail="Enter your name.")
    return name


# ==========================================
# Decisions
# ==========================================
def _claim(record_id: str) -> Optional[dict]:
    """Mark the review as sending (once): returns it, or None when it is already decided or in progress."""
    with store.transaction():
        record = store.get(REVIEWS, record_id)
        if record["status"] in ("approved", "declined"):
            return None
        if record["status"] == "sending":
            started = datetime.fromisoformat(str(record.get("sendingSince") or "1970-01-01T00:00:00+00:00"))
            if _now() - started < SENDING_TIMEOUT:
                return None
        record["status"] = "sending"
        record["sendingSince"] = _now().isoformat()
        # Kept across retries, so a failed email never uses up a second number
        # The submitter's branch series for this month, shared with the Invoice Block (e.g. BLR1126254)
        record["invoiceNumber"] = record.get("invoiceNumber") or invoice.next_number(
            invoice.branch_code_for(record.get("submittedById"))[0], source=f"old-client:{record.get('saleId') or ''}")
        store.put(REVIEWS, record_id, record)
        return record


def _email_invoice(record: dict, issued: datetime) -> dict:
    settings = email_kit._settings()
    email_kit._require_sender(settings)
    d = record["details"]
    pdf = invoice.build_pdf(d, record["invoiceNumber"], issued)
    company = email_kit._company_name()
    name = cit.client_name(d) or "Client"
    gross, gst = invoice.amount(d.get("grossSales")), invoice.amount(d.get("gst"))
    service = " ".join(x for x in (d.get("serviceName"), f"({d['serviceTenure']})" if d.get("serviceTenure") else "") if x)
    expiry = cit.service_expiry(d)
    validity = f"Your service is valid until {expiry}.\n\n" if expiry else ""
    body = (f"Dear {name},\n\n"
            f"Thank you for continuing with {company}. Please find attached invoice {record['invoiceNumber']}"
            f"{' for ' + service if service else ''}.\n\n"
            f"Amount paid: {invoice.rupees(gross)} (including GST of {invoice.rupees(gst)}).\n\n"
            f"{validity}"
            f"If you have any questions, simply reply to this email.\n\nWarm regards,\n{company}")
    msg = email_kit._message(settings, d["email"], f"Invoice {record['invoiceNumber']} from {company}", body)
    file_name = f"Invoice {record['invoiceNumber'].replace('/', '-')}.pdf"
    msg.add_attachment(pdf, maintype="application", subtype="pdf", filename=file_name)
    email_kit._smtp_send(settings, msg)
    store.put(INVOICE_PDFS, record["id"], {"id": record["id"], "data": base64.b64encode(pdf).decode("ascii")})
    return {"from": settings["senderEmail"], "fileName": file_name, **email_kit._save_to_sent(settings, msg)}


def _sale_matches(sale: dict, lead_id: str, user_id: Optional[str]) -> bool:
    """An Old Client sale, still awaiting approval, submitted by this user, for this lead."""
    return (sale.get("clientType") == CLIENT_TYPE and sale.get("status") == STATUS_AWAITING
            and sale.get("submittedByUserId") == user_id and (sale.get("leadId") or "") == (lead_id or ""))


def _update_crm(record: dict, sale_fields: dict, lead_fields: dict, history: str) -> None:
    """Move the sale and lead on; the browsers pick the change up on their next sync.
    Only the submitter's own awaiting Old Client sale (and its lead) is touched, so a review can never be
    pointed at someone else's sale or lead."""
    sale = store.get("sales", record["saleId"]) if record.get("saleId") else None
    if not sale or not _sale_matches(sale, record.get("leadId") or "", record.get("submittedById")):
        log.warning("Old client review for sale %s: sale missing or not an awaiting Old Client sale of the submitter; "
                    "CRM records left unchanged", record.get("saleId"))
        return
    store.put("sales", sale["id"], {**sale, **sale_fields})
    lead = store.get("leads", record["leadId"]) if record.get("leadId") else None
    if lead:
        today = datetime.now(IST).strftime("%Y-%m-%d")
        store.put("leads", lead["id"], {**lead, **lead_fields,
                                        "history": [*(lead.get("history") or []), {"date": today, "text": history}]})


def _tell_group(record: dict, text: str) -> None:
    """Reply under the original group message. The decision already stands, so a failure is only logged."""
    cfg = cit.settings()
    tg = record.get("telegram") or {}
    if not cfg["token"] or not tg.get("chatId"):
        return
    try:
        cit._telegram(cfg["token"], "sendMessage", chat_id=tg["chatId"], text=text, parse_mode="HTML",
                      reply_parameters={"message_id": tg.get("messageId"), "allow_sending_without_reply": True})
    except cit.TelegramError as err:
        log.warning("Could not post the old-client decision to Telegram: %s", err)


@router.post("/review/{token}/approve")
def approve(token: str, reviewer: str = Form("")):
    record = _record_or_404(token)
    name = _reviewer(reviewer)
    claimed = _claim(record["id"])
    if not claimed:
        return _back(token)
    issued = _now()
    try:
        sent = _email_invoice(claimed, issued)
    except Exception as err:  # noqa: BLE001 - any failure must release the claim so it can be retried
        detail = err.detail if isinstance(err, HTTPException) else f"{type(err).__name__}: {err}"
        log.warning("Old client invoice for sale %s not sent: %s", claimed.get("saleId"), detail)
        d = claimed.get("details") or {}
        email_kit.record_failure("Old Client Invoice", cit.client_name(d), d.get("email") or "", detail, by=name,
                                 saleId=claimed.get("saleId") or "", reviewId=claimed["id"],
                                 invoiceNumber=claimed.get("invoiceNumber") or "")
        with store.transaction():
            current = store.get(REVIEWS, claimed["id"])
            current.update(status="pending", sendingSince=None, lastError=str(detail))
            store.put(REVIEWS, current["id"], current)
        return _page(current, token, status_code=502)

    d = claimed["details"]
    with store.transaction():
        current = store.get(REVIEWS, claimed["id"])
        current.update(status="approved", decidedBy=name, decidedAt=issued.isoformat(), emailedTo=d["email"],
                       invoiceFile=sent["fileName"], sentFrom=sent["from"], lastError=None, sendingSince=None)
        store.put(REVIEWS, current["id"], current)
    _update_crm(current,
                {"status": STATUS_APPROVED, "stage": STAGE_APPROVED, "invoiceNumber": current["invoiceNumber"],
                 "invoiceEmailedAt": issued.isoformat(), "invoiceEmailedTo": d["email"], "oldClientReviewedBy": name},
                {"disposition": "Paid / Converted"},
                f"Old client sale approved in Telegram review by {name}. Invoice {current['invoiceNumber']} emailed to {d['email']}.")
    _tell_group(current, f"✅ <b>Approved</b> by {html.escape(name)}: invoice <code>{html.escape(current['invoiceNumber'])}</code> "
                         f"emailed to {html.escape(d['email'])} for {cit._e(cit.client_name(d))}.")
    return _back(token)


@router.post("/review/{token}/decline")
def decline(token: str, reviewer: str = Form(""), reason: str = Form("")):
    record = _record_or_404(token)
    name = _reviewer(reviewer)
    reason = " ".join((reason or "").split())[:500]
    with store.transaction():
        current = store.get(REVIEWS, record["id"])
        if current["status"] != "pending":
            return _back(token)
        current.update(status="declined", decidedBy=name, decidedAt=_now().isoformat(), declineReason=reason)
        store.put(REVIEWS, current["id"], current)
    _update_crm(current, {"status": STATUS_DECLINED, "stage": STAGE_DECLINED, "oldClientReviewedBy": name,
                          "declineReason": reason},
                {"disposition": "Old Client Review Declined"},
                f"Old client sale declined in Telegram review by {name}." + (f" Reason: {reason}" if reason else ""))
    d = current["details"]
    _tell_group(current, f"❌ <b>Declined</b> by {html.escape(name)} for {cit._e(cit.client_name(d))}."
                         + (f"\nReason: {html.escape(reason)}" if reason else ""))
    return _back(token)
