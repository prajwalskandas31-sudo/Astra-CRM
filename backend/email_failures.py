"""
Email Block: Failed Email Deliveries report.

Lists every client email the CRM tried to send that did not reach the client, so it can be followed up:
  - Welcome Kits and Old Client invoices the mail server would not take (email_kit.record_failure),
  - Service Expiry Emails that failed or were skipped for want of a valid Email ID (service_expiry log),
  - bounces: emails the mail server accepted but the client's server later returned. Those only show up as
    "Undelivered Mail" messages in the sender mailbox, so the INBOX is scanned for them over IMAP.

A failure counts as resolved once a later send to that client succeeded; any row can also be marked as
reviewed (followed up) by an Admin.
"""
import email
import hashlib
import imaplib
import re
import ssl
from datetime import datetime, timedelta, timezone
from email import policy
from email.parser import HeaderParser
from email.utils import parsedate_to_datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

try:
    from backend import store, email_kit, service_expiry, old_client_review, extended_service
    from backend.auth import require_roles
except ImportError:
    import store
    import email_kit
    import service_expiry
    import old_client_review
    import extended_service
    from auth import require_roles

router = APIRouter(prefix="/api/email/failures", tags=["email"])
read_roles = require_roles(["Super Admin", "Admin"])

BOUNCES = "emailBounces"            # {bounce key: parsed bounce}
SCAN = "emailBounceScan"            # {"at", "checked", "found", "error"}
REVIEWS = "emailFailureReviews"     # {row id: {"by", "at", "note"}}
BOUNCE_LIMIT = 1000
SCAN_DAYS = 90
SCAN_MAX_MESSAGES = 200
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

# How bounce messages identify themselves (Exim/Hostinger, Postfix, Gmail, Microsoft 365, ...)
BOUNCE_SEARCHES = (
    'FROM "mailer-daemon"', 'FROM "postmaster"', 'SUBJECT "Undelivered"', 'SUBJECT "Undeliverable"',
    'SUBJECT "Delivery Status Notification"', 'SUBJECT "Mail delivery failed"', 'SUBJECT "Returned mail"',
    'SUBJECT "failure notice"', 'SUBJECT "Delivery has failed"',
)
ADDRESS_RE = re.compile(r"[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# Where a plain-text bounce stops describing the failure and starts quoting the original email
QUOTE_MARKERS = re.compile(r"^(-{2,}.*(original message|copy of the message|message headers).*|"
                           r"original message headers?:?|-+ ?below this line.*)$", re.I | re.M)
DIAGNOSTIC_RE = re.compile(r"(\b[45]\d\d[ -][45]\.\d+\.\d+\b.*|\b55\d\b.*|.*(smtp error|does not exist|user unknown|"
                           r"mailbox (is )?(unavailable|full)|no such user|address rejected|not found|"
                           r"quota|blocked|rejected).*)", re.I)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ==========================================
# Bounce parsing
# ==========================================
def _text(part) -> str:
    try:
        content = part.get_content()
    except (LookupError, KeyError, ValueError):
        content = part.get_payload(decode=True) or b""
    if isinstance(content, bytes):
        content = content.decode("utf-8", "replace")
    return content if isinstance(content, str) else ""


def _field(block, name: str) -> str:
    """A DSN field's value without its type prefix ("rfc822; a@b.c" -> "a@b.c")."""
    value = " ".join(str(block.get(name) or "").split())
    return value.split(";", 1)[1].strip() if ";" in value else value


def _dsn_blocks(part) -> list:
    """The field blocks of a message/delivery-status part (per-message block first, then one per recipient)."""
    payload = part.get_payload()
    if isinstance(payload, list):
        return payload
    raw = payload if isinstance(payload, str) else _text(part)
    return [HeaderParser().parsestr(chunk.strip() + "\n") for chunk in re.split(r"\n\s*\n", raw) if chunk.strip()]


def parse_bounce(raw: bytes, own_addresses=()) -> list:
    """Every failed (or delayed) recipient a bounce message reports, with the reason given."""
    msg = email.message_from_bytes(raw, policy=policy.default)
    try:
        at = parsedate_to_datetime(str(msg["Date"])).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, IndexError):
        at = _now()
    bounce_id = str(msg["Message-ID"] or "").strip() or hashlib.sha1(raw).hexdigest()
    original = {"subject": "", "messageId": "", "to": ""}
    recipients, texts = [], []
    for part in msg.walk():
        ctype = part.get_content_type()
        if ctype == "message/delivery-status":
            blocks = _dsn_blocks(part)
            for block in blocks[1:] if len(blocks) > 1 else blocks:
                to = _field(block, "Final-Recipient") or _field(block, "Original-Recipient")
                action = (_field(block, "Action") or "failed").lower()
                if not to or action not in ("failed", "delayed"):
                    continue
                recipients.append({"to": to.strip("<>").lower(), "action": action, "status": _field(block, "Status"),
                                   "diagnostic": _field(block, "Diagnostic-Code")[:500]})
        elif ctype == "message/rfc822" and isinstance(part.get_payload(), list) and part.get_payload():
            inner = part.get_payload()[0]
            original = {"subject": str(inner["Subject"] or ""), "messageId": str(inner["Message-ID"] or ""),
                        "to": str(inner["To"] or "")}
        elif ctype == "text/rfc822-headers":
            inner = HeaderParser().parsestr(_text(part))
            original = {"subject": str(inner["Subject"] or ""), "messageId": str(inner["Message-ID"] or ""),
                        "to": str(inner["To"] or "")}
        elif ctype == "text/plain":
            texts.append(_text(part))

    if not recipients:
        # Plain-text bounce (e.g. Exim's "Mail delivery failed"): the addresses and reason before the quoted email
        text = "\n".join(texts)
        cut = QUOTE_MARKERS.search(text)
        head = text[:cut.start()] if cut else text
        own = {a.lower() for a in own_addresses if a}
        lines = [ln.strip() for ln in head.splitlines() if ln.strip()]
        diagnostic = " ".join(ln for ln in lines if DIAGNOSTIC_RE.search(ln))[:500]
        seen = set()
        for addr in ADDRESS_RE.findall(head):
            addr = addr.lower().rstrip(".")
            local = addr.split("@", 1)[0]
            if addr in own or addr in seen or local in ("mailer-daemon", "postmaster", "noreply", "no-reply"):
                continue
            seen.add(addr)
            recipients.append({"to": addr, "action": "failed", "status": "", "diagnostic": diagnostic})
        if not recipients and original["to"]:
            recipients = [{"to": a.lower(), "action": "failed", "status": "", "diagnostic": diagnostic}
                          for a in ADDRESS_RE.findall(original["to"])]

    return [{"key": f"{bounce_id}|{r['to']}", "bounceId": bounce_id, "at": at,
             "bounceSubject": str(msg["Subject"] or ""), "originalSubject": original["subject"],
             "originalMessageId": original["messageId"], **r} for r in recipients]


def _imap_date(days_ago: int) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return f"{d.day:02d}-{MONTHS[d.month - 1]}-{d.year}"


def scan_bounces() -> dict:
    """Read bounce messages from the sender mailbox's INBOX (read-only: nothing is marked or moved)."""
    settings = email_kit._settings()
    state = {"at": _now(), "checked": 0, "found": 0, "error": ""}
    host = email_kit._imap_host(settings)
    if not settings.get("senderEmail") or not settings.get("smtpPassword") or not host:
        state["error"] = "Set up the Sender Email ID (with its password) to check the mailbox for bounced emails."
        store.set_value(SCAN, state)
        return state
    own = (settings.get("senderEmail"), settings.get("smtpUsername"), settings.get("replyTo"))
    found = []
    try:
        with imaplib.IMAP4_SSL(host, 993, timeout=30, ssl_context=ssl.create_default_context()) as imap:
            imap.login(settings.get("smtpUsername") or settings["senderEmail"], settings["smtpPassword"])
            status, _ = imap.select("INBOX", readonly=True)
            if status != "OK":
                raise imaplib.IMAP4.error("could not open INBOX")
            since = _imap_date(SCAN_DAYS)
            numbers = set()
            for criterion in BOUNCE_SEARCHES:
                status, data = imap.search(None, f"(SINCE {since} {criterion})")
                if status == "OK" and data and data[0]:
                    numbers.update(data[0].split())
            for num in sorted(numbers, key=int)[-SCAN_MAX_MESSAGES:]:
                status, data = imap.fetch(num, "(BODY.PEEK[])")
                raw = next((item[1] for item in data or [] if isinstance(item, tuple)), None)
                if status == "OK" and raw:
                    state["checked"] += 1
                    found += parse_bounce(raw, own)
    except (imaplib.IMAP4.error, OSError) as err:
        state["error"] = f"Could not read the mailbox {settings['senderEmail']} via {host}: {err}"

    with store.update_value(BOUNCES, {}) as box:
        bounces = box[0] or {}
        for b in found:
            bounces.setdefault(b["key"], {**b, "foundAt": state["at"]})
        if len(bounces) > BOUNCE_LIMIT:
            bounces = dict(sorted(bounces.items(), key=lambda kv: kv[1].get("at") or "")[-BOUNCE_LIMIT:])
        box[0] = bounces
    state["found"] = len(found)
    store.set_value(SCAN, state)
    return state


# ==========================================
# The report
# ==========================================
def _client_index() -> dict:
    """email -> {"clientName", "saleId"/"paidId"} for every client the CRM knows an Email ID of."""
    index = {}
    for sale in store.all("sales"):
        c = email_kit._client(sale)
        if c["email"]:
            index.setdefault(c["email"].lower(), {"clientName": c["name"], "saleId": sale.get("id")})
    for paid in store.all("paidClients"):
        addr = (paid.get("email") or "").strip().lower()
        if addr:
            index.setdefault(addr, {"clientName": paid.get("clientName") or "", "paidId": paid.get("id")})
    return index


def _rows() -> list:
    kit_log = store.get_value(email_kit.LOG, []) or []
    rows = []

    for f in store.get_value(email_kit.FAILURES, []) or []:
        resolved = ""
        if f["source"] == "Welcome Kit":
            later = next((e for e in kit_log if e.get("saleId") == f.get("saleId") and e.get("sentAt", "") > f["at"]), None)
            if later:
                resolved = f"Welcome Kit sent to {later['to']} on {later['sentAt'][:10]}"
        elif f.get("assignmentId"):
            assignment = store.get(extended_service.ASSIGNMENTS, f["assignmentId"]) or {}
            if assignment.get("emailStatus") == "sent":
                resolved = f"Invoice emailed to {assignment.get('emailedTo') or 'the client'}"
        elif f.get("reviewId"):
            review = store.get(old_client_review.REVIEWS, f["reviewId"]) or {}
            if review.get("status") == "approved":
                resolved = f"Invoice emailed to {review.get('emailedTo') or 'the client'}"
        rows.append({**f, "kind": "Not sent", "resolved": resolved})

    expiry_state = store.get_value(service_expiry.SENT, {}) or {}
    for e in store.get_value(service_expiry.LOG, []) or []:
        if e.get("status") not in ("failed", "skipped"):
            continue
        now = expiry_state.get(e.get("paidId")) or {}
        rows.append({"id": e["id"], "source": "Service Expiry Email", "clientName": e.get("clientName") or "",
                     "to": e.get("to") or "", "error": e.get("error") or "", "at": e.get("sentAt") or "",
                     "attemptedBy": e.get("sentBy") or "", "paidId": e.get("paidId"),
                     "kind": "No valid Email ID" if e["status"] == "skipped" else "Not sent",
                     "resolved": f"Sent to {now.get('to')}" if now.get("status") == "sent" else ""})

    index = _client_index()
    for b in (store.get_value(BOUNCES, {}) or {}).values():
        client = index.get(b["to"], {})
        later = next((e for e in kit_log if e.get("to", "").lower() == b["to"] and e.get("sentAt", "") > b["at"]), None)
        rows.append({"id": "bounce-" + hashlib.sha1(b["key"].encode()).hexdigest()[:16], "source": "Bounced (mailbox)",
                     "clientName": client.get("clientName", ""), "matched": bool(client), "to": b["to"],
                     "error": b.get("diagnostic") or b.get("bounceSubject") or "Returned as undeliverable",
                     "status": b.get("status", ""), "at": b["at"], "attemptedBy": "",
                     "subject": b.get("originalSubject", ""), "saleId": client.get("saleId"), "paidId": client.get("paidId"),
                     "kind": "Delayed" if b.get("action") == "delayed" else "Bounced",
                     # A bounce stays open until reviewed: the address itself is what needs correcting
                     "resolved": ""})
        if later and b.get("action") == "delayed":
            rows[-1]["resolved"] = f"A later email to this address went out on {later['sentAt'][:10]}"

    reviews = store.get_value(REVIEWS, {}) or {}
    for r in rows:
        r["review"] = reviews.get(r["id"])
    rows.sort(key=lambda r: r.get("at") or "", reverse=True)
    return rows


def delivery_rows() -> list:
    """One row per client email the CRM triggered, sent or not: the Recently Sent Welcome Kits, every other
    email that went out (Service Expiry, Old Client and Extended Service invoices) and every failure above."""
    rows = []
    for e in store.get_value(email_kit.LOG, []) or []:
        agreement = ("Signed agreement attached" + (f" + {len(e.get('kycFiles') or [])} e-KYC" if e.get("kycFiles") else "")
                     if e.get("agreementAttached") else "No signed agreement")
        rows.append({"id": e["id"], "at": e.get("sentAt") or "", "emailType": "Welcome Kit", "clientName": e.get("clientName") or "",
                     "to": e.get("to") or "", "from": e.get("from") or "", "status": "Sent", "kind": "Delivered to mail server",
                     "detail": f"{len(e.get('attachments') or [])} attachment(s); {agreement}", "by": e.get("sentBy") or "",
                     "saleId": e.get("saleId") or "", "resolved": ""})
    for e in store.get_value(service_expiry.LOG, []) or []:
        if e.get("status") == "sent":
            rows.append({"id": e["id"], "at": e.get("sentAt") or "", "emailType": "Service Expiry Email",
                         "clientName": e.get("clientName") or "", "to": e.get("to") or "", "from": e.get("from") or "",
                         "status": "Sent", "kind": "Delivered to mail server",
                         "detail": " ".join(x for x in (e.get("serviceName"), f"(ended {e['endDate']})" if e.get("endDate") else "") if x),
                         "by": e.get("sentBy") or "", "paidId": e.get("paidId") or "", "resolved": ""})
    for r in store.all(old_client_review.REVIEWS):
        if r.get("status") == "approved" and r.get("emailedTo"):
            d = r.get("details") or {}
            rows.append({"id": r["id"], "at": r.get("decidedAt") or "", "emailType": "Old Client Invoice",
                         "clientName": " ".join(x for x in (d.get("clientPrefix"), d.get("clientName")) if x),
                         "to": r["emailedTo"], "from": r.get("sentFrom") or "", "status": "Sent", "kind": "Delivered to mail server",
                         "detail": f"Invoice {r.get('invoiceNumber') or ''}".strip(), "by": r.get("decidedBy") or "",
                         "saleId": r.get("saleId") or "", "resolved": ""})
    for a in extended_service.sent_log():
        rows.append({"id": a["id"], "at": a.get("emailedAt") or "", "emailType": "Extended Service Invoice",
                     "clientName": a.get("clientName") or "", "to": a.get("emailedTo") or "", "from": a.get("emailedFrom") or "",
                     "status": "Sent", "kind": "Delivered to mail server",
                     "detail": f"Invoice {a.get('invoiceNumber') or ''} for {a.get('serviceName') or ''}".strip(),
                     "by": a.get("assignedBy") or "", "resolved": ""})
    for f in _rows():
        rows.append({"id": f["id"], "at": f.get("at") or "", "emailType": f.get("source") or "",
                     "clientName": f.get("clientName") or "", "to": f.get("to") or "", "from": "",
                     "status": "Failed", "kind": f.get("kind") or "", "detail": f.get("error") or "",
                     "by": f.get("attemptedBy") or "", "saleId": f.get("saleId") or "", "paidId": f.get("paidId") or "",
                     "resolved": f.get("resolved") or "",
                     "reviewed": f"Reviewed by {f['review'].get('by')}" if f.get("review") else ""})
    rows.sort(key=lambda r: ((r["clientName"] or r["to"]).strip().lower(), r["at"]))
    return rows


@router.get("/delivery-report")
def delivery_report(current_user: dict = Depends(read_roles)):
    rows = delivery_rows()
    return {
        "rows": rows,
        "summary": {
            "total": len(rows),
            "sent": sum(1 for r in rows if r["status"] == "Sent"),
            "failed": sum(1 for r in rows if r["status"] == "Failed"),
            "clients": len({(r["clientName"] or r["to"]).strip().lower() for r in rows}),
        },
    }


@router.get("")
def report(current_user: dict = Depends(read_roles)):
    rows = _rows()
    open_rows = [r for r in rows if not r["resolved"] and not r["review"]]
    return {
        "rows": rows,
        "summary": {
            "total": len(rows),
            "open": len(open_rows),
            "clients": len({(r["clientName"] or r["to"]).lower() for r in open_rows}),
            "bySource": {s: sum(1 for r in open_rows if r["source"] == s) for s in sorted({r["source"] for r in rows})},
        },
        "scan": store.get_value(SCAN) or None,
    }


@router.post("/scan")
def scan(current_user: dict = Depends(read_roles)):
    state = scan_bounces()
    return {**report(current_user), "scan": state}


class ReviewNote(BaseModel):
    note: Optional[str] = ""


@router.put("/{row_id}/review")
def mark_reviewed(row_id: str, req: ReviewNote, current_user: dict = Depends(read_roles)):
    if not any(r["id"] == row_id for r in _rows()):
        raise HTTPException(status_code=404, detail="No such failed email.")
    with store.update_value(REVIEWS, {}) as box:
        reviews = box[0] or {}
        reviews[row_id] = {"by": current_user.get("name") or "", "at": _now(), "note": " ".join((req.note or "").split())[:500]}
        box[0] = reviews
    return reviews[row_id]


@router.delete("/{row_id}/review")
def unmark_reviewed(row_id: str, current_user: dict = Depends(read_roles)):
    with store.update_value(REVIEWS, {}) as box:
        reviews = box[0] or {}
        reviews.pop(row_id, None)
        box[0] = reviews
    return {"ok": True}
