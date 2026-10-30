"""Trade Call Broadcasts: a Telegram bot per service relays each posted call as SMS to that
service's active Paid clients through the wappie SMS gateway.

The Paid block lives in the browser, so admin sessions sync it here (paid_clients.json); this
server copy is what the always-on Telegram pollers read when a call comes in.

Only Telegram accounts whose phone number is listed in TELEGRAM_ALLOWED_PHONES can post: the
sender proves the number once by tapping "Share my number", and their Telegram user id is stored.
"""
import json
import logging
import os
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

try:
    from backend.auth import require_roles, ADMIN_ROLES
except ImportError:
    from auth import require_roles, ADMIN_ROLES


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
DATA_DIR = os.path.join(BACKEND_DIR, "data")
PAID_CLIENTS_PATH = os.path.join(DATA_DIR, "paid_clients.json")
# Ids deleted from the Paid block; a browser that still has one cached can never re-add it
DELETED_PAID_PATH = os.path.join(DATA_DIR, "paid_clients_deleted.json")
BROADCASTS_PATH = os.path.join(DATA_DIR, "broadcasts.json")
SENDERS_PATH = os.path.join(DATA_DIR, "telegram_senders.json")
OFFSETS_PATH = os.path.join(DATA_DIR, "telegram_offsets.json")

ENV_KEYS = ("TELEGRAM_BOTS", "TELEGRAM_ALLOWED_PHONES", "SMS_ACCESS_TOKEN", "SMS_SENDER", "SMS_SERVICE",
            "SMS_COUNTRY_CODE", "SMS_API_URL", "SMS_MESSAGE_FORMAT", "SMS_MAX_CHARS", "SMS_TEST_RECIPIENT", "SMS_DRY_RUN")
DEFAULT_SMS_API_URL = "https://apis.wappie.shop/v1/sms/messages"
TELEGRAM_API = "https://api.telegram.org"
IST = timezone(timedelta(hours=5, minutes=30))
PAID_STATUS_EXPIRED = "Service Expired"
MAX_PAID_CLIENTS = 20_000
MAX_LOGGED_BROADCASTS = 200
# Calls older than this when they reach the server (e.g. queued while it was down) are not sent:
# a stale trade call is worse than none.
MAX_CALL_AGE_SECONDS = 300
SEND_WORKERS = 8
PAID_FIELDS = ("id", "saleId", "leadId", "clientName", "phone", "serviceName", "serviceTenure",
               "serviceStartDate", "serviceEndDate", "status")

router = APIRouter(tags=["broadcasts"])
# The wappie gateway (GET only) and Telegram both carry their tokens in the URL, and httpx logs full
# request URLs at INFO, so keep its logger quiet; our own errors record only the exception type.
logging.getLogger("httpx").setLevel(logging.WARNING)
_lock = threading.Lock()
_stop = threading.Event()
_pollers: dict = {}  # service name -> {"username", "error", "thread"}


# ==========================================
# Configuration and storage
# ==========================================
def _load_env() -> dict:
    values = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                values[key.strip()] = val.strip()
    # Real environment variables win over the .env file (for hosted deployments)
    for key in ENV_KEYS:
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def settings() -> dict:
    env = _load_env()
    try:
        bots = json.loads(env.get("TELEGRAM_BOTS") or "{}")
    except json.JSONDecodeError:
        bots = {}
    return {
        "bots": {str(k).strip(): str(v).strip() for k, v in bots.items() if str(v).strip()},
        "allowed_phones": {p for p in (normalize_phone(x) for x in env.get("TELEGRAM_ALLOWED_PHONES", "").split(",")) if p},
        "access_token": env.get("SMS_ACCESS_TOKEN", ""),
        "sender": env.get("SMS_SENDER", ""),
        "service": env.get("SMS_SERVICE", ""),
        "country_code": env.get("SMS_COUNTRY_CODE", "+91"),
        "api_url": env.get("SMS_API_URL", DEFAULT_SMS_API_URL),
        # {call} is the text posted in Telegram, {service} the service name; must match the DLT template
        "message_format": env.get("SMS_MESSAGE_FORMAT", "{call}"),
        "max_chars": int(env.get("SMS_MAX_CHARS") or 480),
        # Comma-separated; while set, every call goes only to these numbers
        "test_recipients": [p for p in dict.fromkeys(normalize_phone(x) for x in env.get("SMS_TEST_RECIPIENT", "").split(",")) if p],
        "dry_run": env.get("SMS_DRY_RUN", "").lower() in ("1", "true", "yes"),
    }


def _read(path: str, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write(path: str, data) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp, path)


def normalize_phone(value) -> Optional[str]:
    """A 10-digit Indian mobile number, or None."""
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits if re.fullmatch(r"[6-9]\d{9}", digits) else None


def mask_phone(phone: str) -> str:
    return phone[:2] + "xxxxx" + phone[-3:] if phone and len(phone) == 10 else "invalid"


def _same_service(a: str, b: str) -> bool:
    return (a or "").strip().lower() == (b or "").strip().lower()


def is_active(client: dict, today: Optional[str] = None) -> bool:
    """Active until the day the tenure ends, judged on the server (IST) so it never depends on a browser."""
    if client.get("status") == PAID_STATUS_EXPIRED:
        return False
    today = today or datetime.now(IST).strftime("%Y-%m-%d")
    end = client.get("serviceEndDate")
    return not end or today < end


def active_recipients(service_name: str) -> List[dict]:
    """Active Paid clients on a service, one entry per phone number."""
    recipients, seen = [], set()
    for client in _read(PAID_CLIENTS_PATH, []):
        phone = normalize_phone(client.get("phone"))
        if phone and phone not in seen and _same_service(client.get("serviceName"), service_name) and is_active(client):
            seen.add(phone)
            recipients.append({"clientName": client.get("clientName") or "", "phone": phone})
    return recipients


# ==========================================
# SMS gateway
# ==========================================
DLT_VAR = re.compile(r"\{\{(\d+)\}\}")
# DLT operators cap each {{n}} value at 30 characters
MAX_VAR_CHARS = 30


def call_pattern(message_format: str) -> Optional[re.Pattern]:
    """For a DLT format with {{n}} slots, a pattern that reads the slot values from a posted call.

    The call is the format's text up to the last slot, e.g. "NIFTY 24500 CE Buy 120 SL 100 Tgt 150"
    for "FNO ALERT: {{1}} Buy {{2}} SL {{3}} Tgt {{4}} <footer>". The words before the first slot are
    optional, words are case-insensitive, and spaces and line breaks are interchangeable.
    """
    slots = list(DLT_VAR.finditer(message_format))
    if not slots:
        return None
    lead = r"\s+".join(re.escape(w) for w in message_format[:slots[0].start()].split())
    parts = [rf"(?:{lead}\s*)?" if lead else ""]
    for i, slot in enumerate(slots):
        last = i == len(slots) - 1
        parts.append(rf"(?P<v{slot.group(1)}>.+)" if last else rf"(?P<v{slot.group(1)}>.+?)")
        if not last:
            words = message_format[slot.end():slots[i + 1].start()].split()
            parts.append(r"\s+" + r"\s+".join(re.escape(w) for w in words) + r"\s+" if words else r"\s+")
    return re.compile(r"^\s*" + "".join(parts) + r"\s*$", re.I | re.S)


def call_example(message_format: str) -> str:
    slots = list(DLT_VAR.finditer(message_format))
    body = message_format[slots[0].start():slots[-1].end()] if slots else "{call}"
    samples = iter(["NIFTY 24500 CE", "120", "100", "150", "x", "y", "z", "w"])
    return " ".join(DLT_VAR.sub(lambda m: next(samples), body).split())


def compose_sms(cfg: dict, service_name: str, call_text: str) -> tuple:
    """The SMS text for a call, and an error when the call does not fit the approved template."""
    fmt = cfg["message_format"].replace("\\n", "\n").replace("{service}", service_name)
    pattern = call_pattern(fmt)
    if not pattern:
        return fmt.replace("{call}", call_text.strip()), None
    match = pattern.match(call_text)
    if not match:
        return "", f"The call does not match the approved SMS template. Post it as: {call_example(fmt)}"
    values = {k[1:]: " ".join(v.split()) for k, v in match.groupdict().items()}
    bad = [v for v in values.values() if not v or len(v) > MAX_VAR_CHARS]
    if bad:
        return "", f"Each value must be 1-{MAX_VAR_CHARS} characters; too long: {bad[0]}"
    return DLT_VAR.sub(lambda m: values[m.group(1)], fmt), None


def send_sms(cfg: dict, phone: str, message: str) -> dict:
    """One SMS through the gateway. Retries once on a network error or 5xx."""
    if cfg["dry_run"]:
        return {"ok": True, "status": "dry-run"}
    params = {"access_token": cfg["access_token"], "to": phone, "country_code": cfg["country_code"],
              "sender": cfg["sender"], "service": cfg["service"], "message": message}
    error = ""
    for attempt in range(2):
        try:
            res = httpx.get(cfg["api_url"], params=params, timeout=20)
        except httpx.HTTPError as err:
            error = f"network error: {type(err).__name__}"
            continue
        body = res.text[:300]
        if res.status_code >= 500 and attempt == 0:
            error = f"HTTP {res.status_code}: {body}"
            continue
        ok = 200 <= res.status_code < 300 and not _body_reports_failure(res)
        return {"ok": ok, "status": res.status_code, "response": body}
    return {"ok": False, "status": "error", "response": error}


def _body_reports_failure(res: httpx.Response) -> bool:
    # Some gateways answer 200 with an error in the body
    try:
        body = res.json()
    except ValueError:
        return False
    if not isinstance(body, dict):
        return False
    status = str(body.get("status", "")).lower()
    return status in ("error", "failed", "failure", "false") or body.get("success") is False or bool(body.get("error"))


def config_problems(cfg: dict) -> List[str]:
    missing = [name for name, key in (("SMS_ACCESS_TOKEN", "access_token"), ("SMS_SENDER", "sender"), ("SMS_SERVICE", "service"))
               if not cfg[key]]
    return [f"{name} is not set in backend/.env" for name in missing]


def broadcast(service_name: str, call_text: str, posted_by: dict, test_only: bool = False) -> dict:
    """Send one trade call to every active client on the service and log the result.
    test_only sends it to the SMS_TEST_RECIPIENT numbers alone, whatever the mode."""
    cfg = settings()
    record = {
        "id": "bc-" + uuid.uuid4().hex[:12],
        "service": service_name,
        "call": call_text,
        "postedBy": posted_by,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "testMode": bool(cfg["test_recipients"]) or test_only,
        "dryRun": cfg["dry_run"],
    }
    problems = config_problems(cfg) if not cfg["dry_run"] else []
    if test_only and not cfg["test_recipients"]:
        problems.append("SMS_TEST_RECIPIENT is not set in backend/.env.")
    message, template_error = compose_sms(cfg, service_name, call_text)
    if template_error:
        problems.append(template_error)
    elif len(message) > cfg["max_chars"]:
        problems.append(f"Message is {len(message)} characters; the limit is {cfg['max_chars']}.")
    clients = active_recipients(service_name)
    record.update({"message": message, "activeClients": len(clients)})

    if problems:
        record.update({"status": "Not sent", "error": " ".join(problems), "sent": 0, "failed": 0, "results": []})
    else:
        # Test mode sends the call once, to the test number, so the real wording can be checked safely
        targets = ([{"clientName": "Test recipient", "phone": p} for p in cfg["test_recipients"]]
                   if record["testMode"] else clients)
        with ThreadPoolExecutor(max_workers=SEND_WORKERS) as pool:
            outcomes = list(pool.map(lambda r: send_sms(cfg, r["phone"], message), targets))
        results = [{"clientName": r["clientName"], "phone": mask_phone(r["phone"]), **o} for r, o in zip(targets, outcomes)]
        sent = sum(1 for o in outcomes if o["ok"])
        record.update({
            "status": "Sent" if sent == len(targets) else ("Partly sent" if sent else "Failed"),
            "sent": sent,
            "failed": len(targets) - sent,
            "results": results,
        })

    with _lock:
        log = _read(BROADCASTS_PATH, [])
        _write(BROADCASTS_PATH, [record, *log][:MAX_LOGGED_BROADCASTS])
    return record


# ==========================================
# Telegram bots
# ==========================================
def _telegram(token: str, method: str, timeout: float = 15, **payload) -> dict:
    res = httpx.post(f"{TELEGRAM_API}/bot{token}/{method}", json=payload, timeout=timeout)
    body = res.json()
    if not body.get("ok"):
        raise RuntimeError(body.get("description") or f"Telegram {method} failed")
    return body.get("result")


def _reply(token: str, chat_id: int, text: str, **extra) -> None:
    try:
        _telegram(token, "sendMessage", chat_id=chat_id, text=text, **extra)
    except Exception:
        pass  # the call itself is logged; a lost confirmation must not stop the poller


SHARE_NUMBER_KEYBOARD = {
    "keyboard": [[{"text": "Share my number", "request_contact": True}]],
    "resize_keyboard": True,
    "one_time_keyboard": True,
}


def _summary(record: dict) -> str:
    if record["status"] == "Not sent":
        return f"NOT SENT. {record['error']}"
    head = f"{record['status']}: {record['sent']} of {record['sent'] + record['failed']} SMS delivered to the gateway."
    if record["testMode"]:
        head = f"TEST MODE: sent only to the test number(s). It would have gone to {record['activeClients']} active client(s).\n" + head
    if record["dryRun"]:
        head = "DRY RUN: no SMS was sent.\n" + head
    failures = [r for r in record["results"] if not r["ok"]][:5]
    if failures:
        head += "\nFailed: " + ", ".join(f"{r['clientName']} ({r['phone']})" for r in failures)
    return head


def handle_update(service_name: str, token: str, update: dict) -> None:
    msg = update.get("message")
    if not msg or (msg.get("chat") or {}).get("type") != "private":
        return
    chat_id = msg["chat"]["id"]
    sender = msg.get("from") or {}
    user_id = str(sender.get("id", ""))
    cfg = settings()

    contact = msg.get("contact")
    if contact:
        # Only the account's own number counts, not a forwarded contact card
        phone = normalize_phone(contact.get("phone_number"))
        if str(contact.get("user_id", "")) != user_id or phone not in cfg["allowed_phones"]:
            _reply(token, chat_id, "This number is not authorized to post trade calls.", reply_markup={"remove_keyboard": True})
            return
        with _lock:
            senders = _read(SENDERS_PATH, {})
            senders[user_id] = {"phone": phone, "name": sender.get("first_name", ""), "authorizedAt": datetime.now(timezone.utc).isoformat()}
            _write(SENDERS_PATH, senders)
        _reply(token, chat_id, f"Verified. Messages you post here go out as SMS to active {service_name} clients.",
               reply_markup={"remove_keyboard": True})
        return

    senders = _read(SENDERS_PATH, {})
    authorized = user_id in senders and senders[user_id].get("phone") in cfg["allowed_phones"]
    if not authorized:
        _reply(token, chat_id, "Only authorized numbers can post trade calls. Tap \"Share my number\" to verify.",
               reply_markup=SHARE_NUMBER_KEYBOARD)
        return

    text = (msg.get("text") or "").strip()
    if not text:
        _reply(token, chat_id, "Only text messages can be sent as SMS.")
        return
    if text.startswith("/"):
        command = text.split()[0].split("@")[0].lower()
        if command == "/status":
            _reply(token, chat_id, f"{service_name}: {len(active_recipients(service_name))} active client(s) will receive the next call.")
        else:
            _reply(token, chat_id, f"Post a trade call here and it is sent as SMS to every active {service_name} client.\n/status shows how many will receive it.")
        return
    if time.time() - msg.get("date", 0) > MAX_CALL_AGE_SECONDS:
        _reply(token, chat_id, "This call reached the server more than 5 minutes late and was NOT sent. Post it again if it is still valid.")
        return

    _reply(token, chat_id, f"Sending to {service_name} clients...")
    record = broadcast(service_name, text, {"telegramUserId": user_id, "name": sender.get("first_name", ""),
                                             "phone": mask_phone(senders[user_id]["phone"])})
    _reply(token, chat_id, _summary(record))


def _poll(service_name: str, token: str) -> None:
    state = _pollers[service_name]
    while not _stop.is_set():
        try:
            state["username"] = _telegram(token, "getMe")["username"]
            state["error"] = None
            break
        except Exception as err:
            state["error"] = f"Bot token rejected or Telegram unreachable: {err}"
            _stop.wait(60)

    while not _stop.is_set():
        try:
            offset = _read(OFFSETS_PATH, {}).get(service_name)
            # Long poll: Telegram holds the request up to 25 s until a message arrives
            res = httpx.post(f"{TELEGRAM_API}/bot{token}/getUpdates",
                             json={"offset": offset, "timeout": 25, "allowed_updates": ["message"]}, timeout=40)
            updates = res.json()
            if not updates.get("ok"):
                raise RuntimeError(updates.get("description"))
            state["error"] = None
            for update in updates["result"]:
                # Advance the offset first so a crash in one message can never re-send it
                with _lock:
                    offsets = _read(OFFSETS_PATH, {})
                    offsets[service_name] = update["update_id"] + 1
                    _write(OFFSETS_PATH, offsets)
                try:
                    handle_update(service_name, token, update)
                except Exception as err:
                    state["error"] = f"Last message failed: {err}"
        except Exception as err:
            state["error"] = f"Polling: {err}"
            _stop.wait(10)


def start_pollers() -> None:
    for service_name, token in settings()["bots"].items():
        if service_name in _pollers:
            continue
        _pollers[service_name] = {"username": None, "error": None}
        thread = threading.Thread(target=_poll, args=(service_name, token), name=f"telegram-{service_name}", daemon=True)
        _pollers[service_name]["thread"] = thread
        thread.start()


def stop_pollers() -> None:
    _stop.set()


# ==========================================
# API: Paid client sync and broadcast log
# ==========================================
class PaidClientSync(BaseModel):
    clients: List[dict]


@router.get("/api/paid-clients")
def get_paid_clients(current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    return {"clients": _read(PAID_CLIENTS_PATH, []), "deletedIds": _read(DELETED_PAID_PATH, [])}


@router.post("/api/paid-clients/sync")
def sync_paid_clients(req: PaidClientSync, current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    """Upsert by id: browsers hold different subsets, so a sync never removes another browser's clients."""
    if len(req.clients) > MAX_PAID_CLIENTS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_PAID_CLIENTS} paid clients can be synced.")
    incoming = {}
    for client in req.clients:
        if not isinstance(client.get("id"), str) or not client["id"]:
            raise HTTPException(status_code=400, detail="Every paid client needs an id.")
        incoming[client["id"]] = {k: client.get(k) for k in PAID_FIELDS}
    with _lock:
        for deleted_id in _read(DELETED_PAID_PATH, []):
            incoming.pop(deleted_id, None)
        stored = _read(PAID_CLIENTS_PATH, [])
        merged = [incoming.pop(c["id"], c) for c in stored]
        merged.extend(incoming.values())
        _write(PAID_CLIENTS_PATH, merged)
    return {"count": len(merged)}


@router.delete("/api/paid-clients/{paid_id}")
def delete_paid_client(paid_id: str, current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    with _lock:
        stored = _read(PAID_CLIENTS_PATH, [])
        _write(PAID_CLIENTS_PATH, [c for c in stored if c.get("id") != paid_id])
        deleted = _read(DELETED_PAID_PATH, [])
        if paid_id not in deleted:
            _write(DELETED_PAID_PATH, [*deleted, paid_id])
    return {"deleted": paid_id}


@router.get("/api/broadcasts")
def get_broadcasts(current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    cfg = settings()
    services = []
    for service_name in cfg["bots"]:
        state = _pollers.get(service_name, {})
        services.append({
            "service": service_name,
            "botUsername": state.get("username"),
            "running": bool(state.get("username")) and not _stop.is_set(),
            "error": state.get("error"),
            "activeClients": len(active_recipients(service_name)),
        })
    senders = _read(SENDERS_PATH, {})
    return {
        "config": {
            "smsReady": not config_problems(cfg),
            "problems": config_problems(cfg),
            "sender": cfg["sender"],
            "service": cfg["service"],
            "messageFormat": cfg["message_format"],
            "testRecipients": [mask_phone(p) for p in cfg["test_recipients"]],
            "dryRun": cfg["dry_run"],
            "allowedPhones": [mask_phone(p) for p in sorted(cfg["allowed_phones"])],
        },
        "services": services,
        "senders": [{"telegramUserId": uid, "name": s.get("name"), "phone": mask_phone(s.get("phone")),
                     "authorizedAt": s.get("authorizedAt"), "stillAllowed": s.get("phone") in cfg["allowed_phones"]}
                    for uid, s in senders.items()],
        "broadcasts": _read(BROADCASTS_PATH, []),
    }


class TestCall(BaseModel):
    service: str
    call: str


@router.post("/api/broadcasts/test")
def send_test_call(req: TestCall, current_user: dict = Depends(require_roles(["Super Admin"]))):
    """Send a call from the CRM to the test numbers only, to check the SMS wording before going live."""
    if not req.call.strip() or not req.service.strip():
        raise HTTPException(status_code=400, detail="Enter a service and the call text.")
    return broadcast(req.service.strip(), req.call, {"name": f"{current_user['name']} (CRM test)", "phone": ""}, test_only=True)
