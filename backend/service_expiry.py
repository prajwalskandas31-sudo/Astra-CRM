"""Service expiry: what happens on the day a Paid client's service tenure ends.

1. Telegram Control Block: the client is disabled. Their status becomes "Service Expired" and every
   ticked trading segment is cleared (kept as "segmentsBeforeExpiry" for reference), so no trade call
   reaches them any more.
2. Email Block: the Service Expiry Email (subject and message set by the Super Admin) is sent to the
   client's registered Email ID, once per Paid client, from the Sender Email ID.

The check runs on the server every few minutes, in the one worker that also runs the Telegram bots, so
it never depends on someone having the CRM open. It is judged in IST like the trade-call recipients.
A browser holding an old copy can sync a record back to "Active"; the next check simply disables it
again, and trade calls skip it in the meantime because they check the end date themselves.
"""
import logging
import threading
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

try:
    from backend import store, email_kit
    from backend.auth import require_roles
    from backend.broadcasts import PAID_CLIENTS, PAID_STATUS_EXPIRED, IST
except ImportError:
    import store
    import email_kit
    from auth import require_roles
    from broadcasts import PAID_CLIENTS, PAID_STATUS_EXPIRED, IST


router = APIRouter(prefix="/api/email/service-expiry", tags=["email"])
log = logging.getLogger("crm.service_expiry")

SETTINGS = "serviceExpiryEmail"   # {"enabled", "subject", "body"}
SENT = "serviceExpirySent"        # {paid client id: {"status", "to", "attempts", ...}}; one email per client
LOG = "serviceExpiryLog"
LOG_LIMIT = 500
CHECK_SECONDS = 10 * 60
# A client whose service ended longer ago than this gets no email (e.g. ones that ended before the
# email was switched on); recent ones are still caught up after a server restart.
CATCH_UP_DAYS = 7
MAX_ATTEMPTS = 3

DEFAULT_SUBJECT = "Your {serviceName} service with {companyName} has ended"
DEFAULT_BODY = (
    "Dear {clientName},\n\n"
    "Your {serviceName} service ({serviceTenure}) with {companyName} ended on {endDate}. "
    "Trade calls for this service have now stopped.\n\n"
    "To renew and keep receiving our calls, simply reply to this email or contact your relationship manager.\n\n"
    "Thank you for being with us.\n\n"
    "Warm regards,\n{companyName}"
)
DEFAULTS = {"enabled": False, "subject": DEFAULT_SUBJECT, "body": DEFAULT_BODY}
PLACEHOLDERS = ("clientName", "companyName", "serviceName", "serviceTenure", "startDate", "endDate", "phone")

read_roles = require_roles(["Super Admin", "Admin"])
write_roles = require_roles(["Super Admin"])
_stop = threading.Event()
_thread: Optional[threading.Thread] = None


# ==========================================
# Helpers
# ==========================================
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def _settings() -> dict:
    return {**DEFAULTS, **(store.get_value(SETTINGS, {}) or {})}


def _days_since(end: Optional[str], today: str) -> Optional[int]:
    try:
        return (date.fromisoformat(today) - date.fromisoformat(end)).days
    except (TypeError, ValueError):
        return None


def _pretty_date(key: Optional[str]) -> str:
    try:
        return date.fromisoformat(key).strftime("%d %b %Y")
    except (TypeError, ValueError):
        return key or ""


def is_over(client: dict, today: str) -> bool:
    end = client.get("serviceEndDate")
    return bool(end) and today >= end


def recipient(client: dict) -> str:
    """The client's registered Email ID: the Paid record's, else the one on their sale."""
    email = (client.get("email") or "").strip()
    if not email and client.get("saleId"):
        sale = store.get("sales", client["saleId"]) or {}
        email = email_kit._client(sale)["email"] if sale else ""
    return email


def render(settings: dict, client: dict) -> tuple:
    name = " ".join(p for p in (client.get("clientPrefix"), client.get("clientName")) if p) or "Client"
    values = {
        "clientName": name,
        "companyName": email_kit._company_name(),
        "serviceName": client.get("serviceName") or "",
        "serviceTenure": client.get("serviceTenure") or "",
        "startDate": _pretty_date(client.get("serviceStartDate")),
        "endDate": _pretty_date(client.get("serviceEndDate")),
        "phone": client.get("phone") or "",
    }
    return email_kit._render(settings["subject"], values), email_kit._render(settings["body"], values)


def _append_log(entry: dict) -> None:
    with store.update_value(LOG, []) as box:
        box[0] = (box[0] or [])[-(LOG_LIMIT - 1):] + [entry]


# ==========================================
# 1. Telegram Control Block: disable the client
# ==========================================
def disable(client: dict, today: str) -> Optional[dict]:
    """The client's record with the service expired and every trading segment cleared, or None when it
    already is."""
    segments = client.get("segments") if isinstance(client.get("segments"), list) else []
    if client.get("status") == PAID_STATUS_EXPIRED and not segments:
        return None
    before = list(dict.fromkeys([*(client.get("segmentsBeforeExpiry") or []), *segments]))
    return {
        **client,
        "status": PAID_STATUS_EXPIRED,
        "expiredAt": client.get("expiredAt") or today,
        "segments": [],
        "segmentsBeforeExpiry": before,
        "telegramDisabledAt": client.get("telegramDisabledAt") or _now(),
    }


# ==========================================
# 2. Email Block: the Service Expiry Email
# ==========================================
def _claim(client: dict, to: str) -> bool:
    """Reserve this client's one expiry email. A failed send may be retried a few times; a client with no
    usable address is retried only once a different address is on file."""
    with store.update_value(SENT, {}) as box:
        sent = box[0] or {}
        prev = sent.get(client["id"])
        if prev:
            if prev["status"] in ("sent", "sending"):
                return False
            if prev["status"] == "failed" and prev.get("attempts", 0) >= MAX_ATTEMPTS:
                return False
            if prev["status"] == "skipped" and prev.get("to") == to:
                return False
        sent[client["id"]] = {"status": "sending", "to": to, "attempts": (prev or {}).get("attempts", 0), "at": _now()}
        box[0] = sent
    return True


def _finish(client_id: str, status: str, **extra) -> None:
    with store.update_value(SENT, {}) as box:
        sent = box[0] or {}
        prev = sent.get(client_id) or {}
        attempts = prev.get("attempts", 0) + (1 if status in ("sent", "failed") else 0)
        sent[client_id] = {**prev, "status": status, "attempts": attempts, "at": _now(), **extra}
        box[0] = sent


def send(client: dict, sent_by: str = "Automatic (service expired)", force: bool = False) -> Optional[dict]:
    """Email the client that their service has ended. Returns the log entry (status sent/failed/skipped).
    Without force, a client already emailed (or being emailed) is left alone and None is returned."""
    settings, mail = _settings(), email_kit._settings()
    to = recipient(client)
    valid = bool(email_kit.EMAIL_RE.match(to))
    if force:
        _finish(client["id"], "sending", to=to)
    elif not _claim(client, to):
        return None

    entry = {"id": uuid.uuid4().hex, "paidId": client["id"], "clientName": client.get("clientName") or "",
             "serviceName": client.get("serviceName") or "", "serviceTenure": client.get("serviceTenure") or "",
             "endDate": client.get("serviceEndDate"), "to": to, "from": mail.get("senderEmail") or "",
             "sentAt": _now(), "sentBy": sent_by}
    if not valid:
        entry.update(status="skipped", error="No valid Email ID on the Client Information Page." if to else
                     "No Email ID on the Client Information Page.")
        _finish(client["id"], "skipped", to=to, error=entry["error"])
        _append_log(entry)
        return entry
    try:
        email_kit._require_sender(mail)
        subject, body = render(settings, client)
        msg = email_kit._message(mail, to, subject, body)
        email_kit._smtp_send(mail, msg)
        entry.update(status="sent", subject=msg["Subject"], **email_kit._save_to_sent(mail, msg))
        _finish(client["id"], "sent", to=to, logId=entry["id"])
    except HTTPException as err:
        entry.update(status="failed", error=str(err.detail))
        _finish(client["id"], "failed", to=to, error=entry["error"])
    except Exception as err:  # never let one client stop the others
        entry.update(status="failed", error=f"{type(err).__name__}: {err}")
        _finish(client["id"], "failed", to=to, error=entry["error"])
    _append_log(entry)
    return entry


# ==========================================
# The check
# ==========================================
def run_check(today: Optional[str] = None) -> dict:
    """Disable every client whose tenure has ended and send the expiry emails that are due."""
    today = today or today_ist()
    settings = _settings()
    disabled, emails = [], []
    for client in store.all(PAID_CLIENTS):
        if not client.get("id") or not is_over(client, today):
            continue
        with store.transaction():
            current = store.get(PAID_CLIENTS, client["id"])
            updated = disable(current, today) if current else None
            if updated:
                store.put(PAID_CLIENTS, client["id"], updated)
                disabled.append(client["id"])
        if settings["enabled"]:
            age = _days_since(client["serviceEndDate"], today)
            if age is not None and age <= CATCH_UP_DAYS:
                entry = send(updated or current or client)
                if entry:
                    emails.append({k: entry[k] for k in ("paidId", "to", "status")})
    if disabled:
        log.info("Service expiry: disabled %d client(s) in the Telegram Control Block", len(disabled))
    return {"date": today, "disabled": disabled, "emails": emails}


def _loop() -> None:
    while not _stop.is_set():
        try:
            run_check()
        except Exception:
            log.exception("Service expiry check failed")
        _stop.wait(CHECK_SECONDS)


def start_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="service-expiry", daemon=True)
    _thread.start()


def stop_worker() -> None:
    _stop.set()


# ==========================================
# API (Email Block → Service Expiry Email)
# ==========================================
class ExpirySettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    subject: Optional[str] = None
    body: Optional[str] = None


def _overview() -> dict:
    today = today_ist()
    sent = store.get_value(SENT, {}) or {}
    expired = [c for c in store.all(PAID_CLIENTS) if is_over(c, today) or c.get("status") == PAID_STATUS_EXPIRED]
    return {
        **_settings(),
        "placeholders": list(PLACEHOLDERS),
        "catchUpDays": CATCH_UP_DAYS,
        "checkMinutes": CHECK_SECONDS // 60,
        "senderEmail": email_kit._settings().get("senderEmail") or "",
        "expiredCount": len(expired),
        "emailedCount": sum(1 for c in expired if (sent.get(c["id"]) or {}).get("status") == "sent"),
        "log": list(reversed(store.get_value(LOG, []) or []))[:100],
    }


@router.get("")
def get_overview(current_user: dict = Depends(read_roles)):
    return _overview()


@router.put("")
def update_settings(req: ExpirySettingsUpdate, current_user: dict = Depends(write_roles)):
    changes = req.model_dump(exclude_none=True)
    if "subject" in changes:
        changes["subject"] = email_kit._one_line(changes["subject"])
        if not changes["subject"]:
            raise HTTPException(status_code=400, detail="Enter a subject for the Service Expiry Email.")
    if "body" in changes:
        if not changes["body"].strip():
            raise HTTPException(status_code=400, detail="Enter the Service Expiry Email message.")
        if len(changes["body"]) > 20000:
            raise HTTPException(status_code=400, detail="The email message is too long (20,000 characters at most).")
    with store.update_value(SETTINGS, {}) as box:
        box[0] = {**(box[0] or {}), **changes, "updatedAt": _now(), "updatedBy": current_user.get("name")}
    return _overview()


@router.post("/run")
def run_now(current_user: dict = Depends(write_roles)):
    """Run the check now instead of waiting for the next automatic one."""
    return run_check()


class ExpiryTest(BaseModel):
    to: Optional[str] = None


@router.post("/test")
def send_test(req: ExpiryTest, current_user: dict = Depends(write_roles)):
    """Mail the template, filled with sample values, to the Sender Email ID (or the given address)."""
    mail = email_kit._settings()
    email_kit._require_sender(mail)
    to = (req.to or mail["senderEmail"]).strip()
    if not email_kit.EMAIL_RE.match(to):
        raise HTTPException(status_code=400, detail="Test recipient is not a valid email address.")
    sample = {"clientName": "Sample Client", "serviceName": "Stock Cash", "serviceTenure": "12 Months",
              "serviceStartDate": "2025-11-10", "serviceEndDate": "2026-11-10", "phone": "9876543210"}
    subject, body = render(_settings(), sample)
    msg = email_kit._message(mail, to, "[TEST] " + subject, body)
    email_kit._smtp_send(mail, msg)
    return {"sent": True, "to": to, "from": mail["senderEmail"]}


@router.post("/send/{paid_id}")
def send_one(paid_id: str, current_user: dict = Depends(write_roles)):
    """Send (or resend) the expiry email to one client whose service has ended."""
    client = store.get(PAID_CLIENTS, paid_id)
    if not client:
        raise HTTPException(status_code=404, detail="Paid client not found.")
    if not (is_over(client, today_ist()) or client.get("status") == PAID_STATUS_EXPIRED):
        raise HTTPException(status_code=400, detail="This client's service has not ended yet.")
    entry = send(client, sent_by=current_user.get("name") or "CRM", force=True)
    if entry["status"] != "sent":
        raise HTTPException(status_code=502 if entry["status"] == "failed" else 400, detail=entry["error"])
    return entry
