"""Broadcast_group (Telegram) -> notification for every CRM user.

One bot long-polls the Telegram Bot API (getUpdates). Every text message (or photo/file caption) typed in
the "Broadcast_group" group becomes a notification in the shared "notifications" collection, addressed
to nobody in particular, so every signed-in CRM user gets it on the next sync (about 5 seconds) as a
pop-up and an entry in the notification tray. Editing the message in Telegram updates the notification.

The bot must be able to see ordinary group messages: either make it an admin of the group, or turn
privacy mode off in BotFather (/setprivacy -> Disable) and then remove and re-add it to the group.

backend/.env (never committed):
    TELEGRAM_BROADCAST_GROUP_BOT_TOKEN=<token from BotFather>
    TELEGRAM_BROADCAST_GROUP=Broadcast_group           optional; the group's title
    TELEGRAM_BROADCAST_GROUP_CHAT_ID=<group chat id>   optional; otherwise found by the title and remembered
"""
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends

try:
    from backend import store
    from backend.auth import require_roles, ADMIN_ROLES
except ImportError:
    import store
    from auth import require_roles, ADMIN_ROLES


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
ENV_KEYS = ("TELEGRAM_BROADCAST_GROUP_BOT_TOKEN", "TELEGRAM_BROADCAST_GROUP", "TELEGRAM_BROADCAST_GROUP_CHAT_ID")
TELEGRAM_API = "https://api.telegram.org"
DEFAULT_GROUP_TITLE = "Broadcast_group"
NOTIFICATIONS = "notifications"
OFFSET_VALUE = "broadcastGroupOffset"
CHAT_ID_VALUE = "broadcastGroupChatId"
STATUS_VALUE = "broadcastGroupStatus"
GROUP_TYPES = ("group", "supergroup")
MAX_TEXT = 3000
IST = timezone(timedelta(hours=5, minutes=30))

router = APIRouter(tags=["broadcast-group"])
# Telegram carries the bot token in the URL, and httpx logs full URLs at INFO
logging.getLogger("httpx").setLevel(logging.WARNING)
_stop = threading.Event()
_state: dict = {"username": None, "error": None, "thread": None}


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
    for key in ENV_KEYS:
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def settings() -> dict:
    env = _load_env()
    return {
        "token": env.get("TELEGRAM_BROADCAST_GROUP_BOT_TOKEN", ""),
        "group_title": env.get("TELEGRAM_BROADCAST_GROUP") or DEFAULT_GROUP_TITLE,
        "chat_id": env.get("TELEGRAM_BROADCAST_GROUP_CHAT_ID", ""),
    }


# ==========================================
# Turning a Telegram update into a notification
# ==========================================
def _is_broadcast_group(cfg: dict, chat: dict) -> bool:
    if chat.get("type") not in GROUP_TYPES:
        return False
    chat_id = str(chat.get("id", ""))
    known = cfg["chat_id"] or store.get_value(CHAT_ID_VALUE)
    if known:
        return chat_id == str(known)
    # Not known yet: match the title once, then remember the id (titles can be renamed later)
    if (chat.get("title") or "").strip().lower() == cfg["group_title"].strip().lower():
        store.set_value(CHAT_ID_VALUE, chat_id)
        return True
    return False


def _sender_name(msg: dict) -> str:
    if msg.get("sender_chat"):  # posted anonymously as the group, or from a linked channel
        return msg["sender_chat"].get("title") or "Group admin"
    sender = msg.get("from") or {}
    name = " ".join(p for p in (sender.get("first_name"), sender.get("last_name")) if p).strip()
    return name or (f"@{sender['username']}" if sender.get("username") else "Telegram user")


def notification_for(msg: dict, group_title: str) -> Optional[dict]:
    text = (msg.get("text") or msg.get("caption") or "").strip()
    if not text:
        return None  # stickers, joins, photos without a caption: nothing to read
    if len(text) > MAX_TEXT:
        text = text[:MAX_TEXT - 1] + "…"
    sent_at = datetime.fromtimestamp(msg.get("date") or time.time(), tz=timezone.utc)
    return {
        "id": f"tg-broadcast-{msg['chat']['id']}-{msg['message_id']}",
        "title": f"{group_title}: {_sender_name(msg)}",
        "message": text,
        "type": "broadcast",
        "timestamp": sent_at.astimezone(IST).strftime("%I:%M %p").lstrip("0"),
        "createdAt": sent_at.isoformat(),
        "read": False,
        "actionType": None,
        "actionPayload": None,
        # No target: every CRM user sees it
        "targetUserId": None,
        "targetRole": None,
        "createdByUserId": None,
        "source": "telegram",
    }


def handle_update(cfg: dict, update: dict) -> Optional[dict]:
    member = update.get("my_chat_member")
    if member:
        _is_broadcast_group(cfg, member.get("chat") or {})  # learn the group id as soon as the bot is added
        return None
    msg = update.get("message") or update.get("edited_message")
    if not msg or not _is_broadcast_group(cfg, msg.get("chat") or {}):
        return None
    note = notification_for(msg, (msg["chat"].get("title") or cfg["group_title"]).strip())
    if note:
        store.put(NOTIFICATIONS, note["id"], note)
    return note


# ==========================================
# The listener
# ==========================================
def _publish_status() -> None:
    try:
        store.set_value(STATUS_VALUE, {"username": _state["username"], "error": _state["error"], "at": time.time()})
    except Exception:
        pass  # status display only; never stop the listener over it


def _telegram(token: str, method: str, timeout: float = 15, **payload):
    res = httpx.post(f"{TELEGRAM_API}/bot{token}/{method}", json=payload, timeout=timeout)
    body = res.json()
    if not body.get("ok"):
        raise RuntimeError(body.get("description") or f"Telegram {method} failed")
    return body.get("result")


def _listen(token: str) -> None:
    while not _stop.is_set():
        try:
            me = _telegram(token, "getMe")
            _state["username"], _state["error"] = me["username"], None
            if not me.get("can_read_all_group_messages"):
                # Still works if the bot is a group admin; otherwise only commands reach it
                _state["error"] = "Privacy mode is on: make the bot an admin of the group, or /setprivacy -> Disable in BotFather."
            break
        except Exception as err:
            _state["error"] = f"Bot token rejected or Telegram unreachable: {type(err).__name__}"
            _publish_status()
            _stop.wait(60)

    last_status = 0.0
    while not _stop.is_set():
        if time.time() - last_status > 60:
            _publish_status()
            last_status = time.time()
        try:
            updates = _get_updates(token)
            cfg = settings()
            for update in updates:
                # Advance the offset first so one bad message can never block the queue
                store.set_value(OFFSET_VALUE, update["update_id"] + 1)
                try:
                    handle_update(cfg, update)
                except Exception as err:
                    _state["error"] = f"Last message failed: {type(err).__name__}"
        except Exception as err:
            # Exception type only: an httpx error message would include the URL, and with it the token
            _state["error"] = f"Polling: {err if isinstance(err, RuntimeError) else type(err).__name__}"
            _publish_status()
            _stop.wait(10)


def _get_updates(token: str) -> list:
    # Long poll: Telegram holds the request up to 25 s until a message arrives
    res = httpx.post(f"{TELEGRAM_API}/bot{token}/getUpdates", timeout=40,
                     json={"offset": store.get_value(OFFSET_VALUE), "timeout": 25,
                           "allowed_updates": ["message", "edited_message", "my_chat_member"]})
    body = res.json()
    if not body.get("ok"):
        raise RuntimeError(body.get("description") or "getUpdates failed")
    return body["result"]


def start() -> None:
    token = settings()["token"]
    if not token or _state["thread"]:
        return
    _stop.clear()
    _state["thread"] = threading.Thread(target=_listen, args=(token,), name="telegram-broadcast-group", daemon=True)
    _state["thread"].start()


def stop() -> None:
    _stop.set()


@router.get("/api/broadcast-group/status")
def status(current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    cfg = settings()
    return {
        "configured": bool(cfg["token"]),
        "groupTitle": cfg["group_title"],
        "groupFound": bool(cfg["chat_id"] or store.get_value(CHAT_ID_VALUE)),
        "listener": store.get_value(STATUS_VALUE),
    }
