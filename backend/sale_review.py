"""Telegram review of Client Information submissions.

"Send to Review" on the Client Information page saves the sale as AWAITING_STATUS. The sync push
puts its id in a small outbox; the bot (one poller, in the worker that holds the poller lock) posts
every detail of the submission, with its transaction attachments, to the review group with Approve
and Reject buttons. Approve moves the sale into the Sale Approval & Automated Verification Queue
(the status the queue lists); Reject sends it back to the person who submitted it.

Configured in backend/.env: SALE_REVIEW_BOT_TOKEN (BotFather token), and optionally
SALE_REVIEW_CHAT_ID. Without a chat id, a member sends /bind in the group once to link it.
The server has no HTTPS, which Telegram webhooks require, so updates are long-polled.
"""
import base64
import html
import json
import logging
import os
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends

try:
    from backend import store
    from backend.auth import get_current_user
    from backend.broadcasts import _load_env
except ImportError:
    import store
    from auth import get_current_user
    from broadcasts import _load_env


AWAITING_STATUS = "Awaiting Telegram Approval"
AWAITING_STAGE = "Awaiting Telegram Approval"
REJECTED_STATUS = "Rejected in Telegram Review"
# What the Sale Approval queue lists (sync.NEW_SALE_STATUSES / SaleApprovalWorkflow.jsx)
QUEUE_STATUS = "Pending Super Admin Review"
QUEUE_STAGE = "Under Review by Super Admin"

OUTBOX = "saleReviewOutbox"      # sale ids waiting to be posted
CHAT = "saleReviewChat"          # {"id", "title"} of the bound group
OFFSET = "saleReviewOffset"
STATUS = "saleReviewStatus"      # poller state, shared because only one worker polls
TELEGRAM_API = "https://api.telegram.org"
POLL_SECONDS = 5                 # long-poll window; also how often the outbox is checked
MAX_SEND_ATTEMPTS = 30
IST = timezone(timedelta(hours=5, minutes=30))
APPROVE, REJECT = "sra", "srr"

log = logging.getLogger("sale_review")
router = APIRouter(prefix="/api/sale-review", tags=["sale-review"])
_stop = threading.Event()
_thread: Optional[threading.Thread] = None


# ==========================================
# Configuration
# ==========================================
def _setting(key: str) -> str:
    return (os.environ.get(key) or _load_env().get(key) or "").strip()


def token() -> str:
    return _setting("SALE_REVIEW_BOT_TOKEN")


def enabled() -> bool:
    return bool(token())


def chat() -> Optional[dict]:
    configured = _setting("SALE_REVIEW_CHAT_ID")
    if configured:
        return {"id": int(configured), "title": "(set in backend/.env)"}
    return store.get_value(CHAT)


# ==========================================
# Called from the sync push (inside its transaction)
# ==========================================
def on_sale_write(old: Optional[dict], new: Optional[dict]) -> None:
    """Queue a sale for the group when it newly enters AWAITING_STATUS."""
    if not new or new.get("status") != AWAITING_STATUS or (old or {}).get("status") == AWAITING_STATUS:
        return
    with store.update_value(OUTBOX, []) as box:
        box[0] = [x for x in (box[0] or []) if x != new["id"]] + [new["id"]]


# ==========================================
# Message
# ==========================================
def _e(value) -> str:
    return html.escape(str(value if value not in (None, "") else "—"))


def _money(value) -> str:
    """₹1,18,000.00 (Indian digit grouping, as the CRM shows amounts)."""
    try:
        whole, paise = f"{float(str(value).replace(',', '').replace('₹', '')):.2f}".split(".")
    except (TypeError, ValueError):
        return _e(value)
    sign, whole = ("-", whole[1:]) if whole.startswith("-") else ("", whole)
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while len(head) > 2:
        head, groups = head[:-2], [head[-2:], *groups]
    return f"₹{sign}{','.join([g for g in [head, *groups] if g] + [tail])}.{paise}"


def _info(sale: dict) -> dict:
    return {**(sale.get("fullClientInfo") or {}), **{k: v for k, v in sale.items() if v not in (None, "")}}


def _attachments(sale: dict) -> list:
    info = sale.get("fullClientInfo") or {}
    files = list(sale.get("transactionAttachments") or info.get("transactionAttachments") or [])
    gst = info.get("gstCertificateFile")
    if isinstance(gst, dict) and gst.get("dataUrl"):
        files.append({**gst, "name": gst.get("name") or "GST certificate", "label": "GST certificate"})
    return [f for f in files if isinstance(f, dict)]


def render(sale: dict, decision: Optional[str] = None) -> str:
    i = _info(sale)
    name = " ".join(x for x in (i.get("clientPrefix"), i.get("contactPerson") or i.get("clientName")) if x)
    txns = [t for t in (i.get("transactionNumbers") or []) if t]
    files = _attachments(sale)
    lines = [
        "<b>📝 Client Information – Review Request</b>",
        f"Sale ID: <code>{_e(sale.get('id'))}</code>",
        f"Submitted by: <b>{_e(sale.get('employeeName') or i.get('agentName'))}</b> on {_e(sale.get('date'))}",
        "",
        "<b>1. Client Identity &amp; Category</b>",
        f"PAN Number: <code>{_e(i.get('panNumber'))}</code>",
        f"Client Category: {_e(i.get('clientCategory'))}",
        f"Client Name (as on PAN): {_e(name)}",
    ]
    if i.get("clientCategory") == "Non-Individual":
        lines += [
            f"Firm Name: {_e(i.get('firmName'))}",
            f"GSTIN: <code>{_e(i.get('gstin'))}</code>",
            f"GST Certificate: {'attached' if isinstance(i.get('gstCertificateFile'), dict) else 'not attached'}",
        ]
    lines += [
        "",
        "<b>2. Contact Information</b>",
        f"Email ID: {_e(i.get('email'))}",
        f"Phone Number 1: {_e(i.get('phone1'))}",
        f"Phone Number 2: {_e(i.get('phone2'))}",
        f"Client State: {_e(i.get('clientState'))}",
        "",
        "<b>3. Service Subscription &amp; Financials</b>",
        f"Payment Date: {_e(i.get('paymentDate'))}",
        f"Service: {_e(i.get('serviceOpted') or i.get('serviceName'))}",
        f"Tenure: {_e(i.get('serviceTenure'))}",
        f"Transaction No(s): {', '.join(f'<code>{_e(t)}</code>' for t in txns) or '—'}",
        f"Gross Sales: <b>{_money(i.get('grossSales'))}</b>",
        f"Net Sales: {_money(i.get('netSales'))}",
        f"GST: {_money(i.get('gst'))}",
        "",
        f"<b>Attachments:</b> {len(files)}" + (" (sent below)" if files else ""),
    ]
    lines += [f"• {_e(f.get('label') or 'Transaction proof')}: {_e(f.get('name'))}" for f in files]
    if decision:
        lines += ["", decision]
    return "\n".join(lines)[:4096]


def _buttons(sale_id: str) -> dict:
    return {"inline_keyboard": [[
        {"text": "✅ Approve", "callback_data": f"{APPROVE}:{sale_id}"},
        {"text": "❌ Reject", "callback_data": f"{REJECT}:{sale_id}"},
    ]]}


# ==========================================
# Telegram
# ==========================================
def _telegram(method: str, timeout: float = 20, files=None, **payload):
    url = f"{TELEGRAM_API}/bot{token()}/{method}"
    if files:
        data = {k: (json.dumps(v) if isinstance(v, (dict, list)) else str(v)) for k, v in payload.items()}
        res = httpx.post(url, data=data, files=files, timeout=60)
    else:
        res = httpx.post(url, json=payload, timeout=timeout)
    body = res.json()
    if not body.get("ok"):
        params = body.get("parameters") or {}
        if params.get("migrate_to_chat_id"):
            _rebind(params["migrate_to_chat_id"])
        if params.get("retry_after"):
            _stop.wait(min(int(params["retry_after"]), 60))
        raise RuntimeError(body.get("description") or f"Telegram {method} failed")
    return body.get("result")


def _decode(data_url: str) -> Optional[bytes]:
    try:
        return base64.b64decode(data_url.split(",", 1)[1]) if "," in data_url else None
    except Exception:
        return None


def post_sale(sale_id: str) -> bool:
    """Post one submission to the group. True when it is done with (posted, or no longer awaiting)."""
    sale = store.get("sales", sale_id)
    if not sale or sale.get("status") != AWAITING_STATUS:
        return True
    target = chat()
    if not target:
        return False  # wait for /bind
    msg = _telegram("sendMessage", chat_id=target["id"], text=render(sale), parse_mode="HTML",
                    reply_markup=_buttons(sale_id), disable_web_page_preview=True)
    for n, f in enumerate(_attachments(sale), 1):
        content = _decode(f.get("dataUrl") or "")
        if not content:
            continue
        try:
            _telegram("sendDocument", files={"document": (f.get("name") or f"attachment-{n}", content, f.get("type") or "application/octet-stream")},
                      chat_id=target["id"], caption=f"{f.get('label') or 'Transaction proof'} – {sale.get('clientName') or ''}"[:1024],
                      reply_parameters={"message_id": msg["message_id"], "allow_sending_without_reply": True})
        except Exception as err:
            log.warning("Attachment %s of %s not sent: %s", n, sale_id, type(err).__name__)
    return True


def flush_outbox() -> None:
    pending = store.get_value(OUTBOX) or []
    if not pending:
        return
    attempts = store.get_value("saleReviewAttempts") or {}
    for sale_id in list(pending):
        try:
            done = post_sale(sale_id)
            error = None
        except Exception as err:
            done, error = False, str(err)
            attempts[sale_id] = attempts.get(sale_id, 0) + 1
            log.warning("Posting %s to Telegram failed: %s", sale_id, type(err).__name__)
        if done or attempts.get(sale_id, 0) >= MAX_SEND_ATTEMPTS:
            with store.update_value(OUTBOX, []) as box:
                box[0] = [x for x in (box[0] or []) if x != sale_id]
            attempts.pop(sale_id, None)
        if error:
            _set_status(error=f"Posting a submission failed: {error}")
            break  # Telegram is unhappy; try again next round
    store.set_value("saleReviewAttempts", attempts)


# ==========================================
# Updates from the group
# ==========================================
def _who(user: dict) -> str:
    name = " ".join(x for x in (user.get("first_name"), user.get("last_name")) if x) or "Group member"
    return f"{name} (@{user['username']})" if user.get("username") else name


def _rebind(new_id: int) -> None:
    # A group upgraded to a supergroup gets a new id
    with store.update_value(CHAT, None) as box:
        if box[0]:
            box[0] = {**box[0], "id": int(new_id)}


def _notify(sale: dict, title: str, message: str, kind: str, **target) -> None:
    note_id = f"notif-tg-{sale['id']}-{uuid.uuid4().hex[:10]}"
    store.put("notifications", note_id, {
        "id": note_id, "title": title, "message": message, "type": kind,
        "timestamp": datetime.now(IST).strftime("%I:%M %p"), "read": False,
        "actionType": "review_sale" if target.get("targetRole") else None,
        "actionPayload": {"saleId": sale["id"], "leadId": sale.get("leadId")},
        "targetUserId": target.get("targetUserId"), "targetRole": target.get("targetRole"),
        "createdByUserId": None,
    })


def decide(sale_id: str, approve: bool, by: str) -> tuple:
    """Apply a group decision. Returns (sale or None, applied: bool)."""
    now = datetime.now(IST)
    with store.transaction():
        sale = store.get("sales", sale_id)
        if not sale or sale.get("status") != AWAITING_STATUS:
            return sale, False
        sale = {**sale,
                "status": QUEUE_STATUS if approve else REJECTED_STATUS,
                "stage": QUEUE_STAGE if approve else "Rejected",
                "voiceCallStatus": "Pending Super Admin Decision" if approve else sale.get("voiceCallStatus"),
                "telegramReview": {"decision": "Approved" if approve else "Rejected", "by": by, "at": now.isoformat()}}
        store.put("sales", sale_id, sale)

        lead = store.get("leads", sale["leadId"]) if sale.get("leadId") else None
        if lead:
            text = (f"Client Information approved in the Telegram review group by {by}. Sent to the Sale Approval queue."
                    if approve else
                    f"Client Information rejected in the Telegram review group by {by}. Correct the details and send it to review again.")
            store.put("leads", lead["id"], {**lead, "history": [*(lead.get("history") or []),
                                                                {"date": now.strftime("%Y-%m-%d"), "text": text}]})

        amount = sale.get("amount") or _money(sale.get("grossSales"))
        if approve:
            _notify(sale, "Review Required: New Sale Submission",
                    f"{sale.get('employeeName') or 'Executive'} submitted sale for '{sale.get('contactPerson') or sale.get('clientName')}' "
                    f"(Gross: {amount}). Approved in the Telegram group by {by}.", "review", targetRole="Super Admin")
        if sale.get("submittedByUserId"):
            _notify(sale, "Client Information Approved" if approve else "Client Information Rejected",
                    f"'{sale.get('clientName')}' was {'approved' if approve else 'rejected'} in the Telegram review group by {by}."
                    + ("" if approve else " Please correct the details and send it to review again."),
                    "success" if approve else "warning", targetUserId=sale["submittedByUserId"])
    return sale, True


def handle_callback(query: dict) -> None:
    data = query.get("data") or ""
    message = query.get("message") or {}
    target = chat()
    answer = {"callback_query_id": query["id"]}
    if ":" not in data or not target or (message.get("chat") or {}).get("id") != target["id"]:
        _telegram("answerCallbackQuery", **answer, text="This button is not active here.")
        return
    action, sale_id = data.split(":", 1)
    if action not in (APPROVE, REJECT):
        return
    by = _who(query.get("from") or {})
    sale, applied = decide(sale_id, action == APPROVE, by)
    when = datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST")
    if applied:
        footer = (f"✅ <b>APPROVED</b> by {_e(by)} · {when}\nMoved to the Sale Approval &amp; Automated Verification Queue."
                  if action == APPROVE else f"❌ <b>REJECTED</b> by {_e(by)} · {when}\nSent back to the executive.")
        text = "Approved – moved to the Sale Approval queue." if action == APPROVE else "Rejected – sent back to the executive."
    elif sale is None:
        footer, text = "⚠️ This submission was withdrawn or replaced in the CRM.", "This submission no longer exists."
    else:
        prior = (sale.get("telegramReview") or {})
        footer = f"ℹ️ Already decided: {_e(prior.get('decision') or sale.get('status'))}" + (f" by {_e(prior['by'])}" if prior.get("by") else "")
        text = "Already decided."
    _telegram("answerCallbackQuery", **answer, text=text)
    try:
        _telegram("editMessageText", chat_id=target["id"], message_id=message["message_id"], parse_mode="HTML",
                  text=render(sale, footer) if sale else (html.escape(message.get("text") or "") + "\n\n" + footer)[:4096],
                  disable_web_page_preview=True)
    except Exception:
        pass  # e.g. "message is not modified"; the decision itself is saved


def handle_message(msg: dict) -> None:
    chat_info = msg.get("chat") or {}
    if msg.get("migrate_to_chat_id") and (chat() or {}).get("id") == chat_info.get("id"):
        _rebind(msg["migrate_to_chat_id"])
        return
    text = (msg.get("text") or "").strip()
    if not text.startswith("/") or chat_info.get("type") not in ("group", "supergroup"):
        return
    command = text.split()[0].split("@")[0].lower()
    if command != "/bind":
        return
    current = chat()
    if _setting("SALE_REVIEW_CHAT_ID"):
        reply = "The review group is fixed in the server settings (SALE_REVIEW_CHAT_ID)."
    elif current and current["id"] != chat_info["id"]:
        reply = "This bot already posts to another group. Ask the CRM administrator to change it."
    else:
        store.set_value(CHAT, {"id": chat_info["id"], "title": chat_info.get("title") or ""})
        reply = "✅ Linked. Client Information submissions from the CRM will be posted here for Approve / Reject."
    _telegram("sendMessage", chat_id=chat_info["id"], text=reply)


def handle_update(update: dict) -> None:
    if update.get("callback_query"):
        handle_callback(update["callback_query"])
    elif update.get("message"):
        handle_message(update["message"])


# ==========================================
# Poller
# ==========================================
def _set_status(**fields) -> None:
    try:
        with store.update_value(STATUS, {}) as box:
            box[0] = {**(box[0] or {}), **fields, "at": time.time()}
    except Exception:
        pass


def _poll() -> None:
    while not _stop.is_set():
        try:
            me = _telegram("getMe")
            _set_status(username=me.get("username"), error=None)
            break
        except Exception as err:
            _set_status(error=f"Bot token rejected or Telegram unreachable: {err}")
            _stop.wait(60)
    last_beat = 0.0
    while not _stop.is_set():
        try:
            flush_outbox()
            res = httpx.post(f"{TELEGRAM_API}/bot{token()}/getUpdates", timeout=POLL_SECONDS + 15,
                             json={"offset": store.get_value(OFFSET), "timeout": POLL_SECONDS,
                                   "allowed_updates": ["message", "callback_query"]})
            body = res.json()
            if not body.get("ok"):
                raise RuntimeError(body.get("description"))
            for update in body["result"]:
                store.set_value(OFFSET, update["update_id"] + 1)  # first, so one bad update is never replayed
                try:
                    handle_update(update)
                except Exception as err:
                    log.warning("Telegram update failed: %s", type(err).__name__)
            if time.time() - last_beat > 60:
                _set_status(error=None)
                last_beat = time.time()
        except Exception as err:
            _set_status(error=f"Polling: {err}")
            _stop.wait(10)


def start() -> None:
    global _thread
    if not enabled() or (_thread and _thread.is_alive()):
        return
    _thread = threading.Thread(target=_poll, name="telegram-sale-review", daemon=True)
    _thread.start()


def stop() -> None:
    _stop.set()


# ==========================================
# API
# ==========================================
@router.get("/status")
def status(current_user: dict = Depends(get_current_user)):
    """Whether "Send to Review" goes to the Telegram group first (the screens choose the status by it)."""
    result = {"enabled": enabled()}
    if current_user.get("role") == "Super Admin":
        state = store.get_value(STATUS) or {}
        result.update({"group": (chat() or {}).get("title"), "linked": bool(chat()),
                       "bot": state.get("username"), "error": state.get("error"),
                       "queued": len(store.get_value(OUTBOX) or [])})
    return result
