"""Client Information Page -> Telegram group.

When an executive presses "Send to Review" on the Client Information Page, every detail on the page is
posted by the Client_info_page_updates bot into the "Client_information_page_updates" group. The
message ends with the e-KYC link: it opens the CRM, which runs the same "Trigger e-KYC & E-Sign"
dispatch as Sale Approvals (Leegality still requires a Super Admin sign-in, so a forwarded message
cannot spend Leegality credits on its own).

backend/.env (never committed):
    TELEGRAM_CLIENT_INFO_BOT_TOKEN=<token from BotFather>
    TELEGRAM_CLIENT_INFO_CHAT_ID=<group chat id>   optional; found automatically, see _chat_id()
    CRM_PUBLIC_URL=http://host:port                required; the only address the e-KYC link may point to
"""
import html
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

try:
    from backend import store
    from backend.auth import get_current_user
except ImportError:
    import store
    from auth import get_current_user


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
ENV_KEYS = ("TELEGRAM_CLIENT_INFO_BOT_TOKEN", "TELEGRAM_CLIENT_INFO_CHAT_ID", "TELEGRAM_CLIENT_INFO_GROUP", "CRM_PUBLIC_URL")
TELEGRAM_API = "https://api.telegram.org"
DEFAULT_GROUP_TITLE = "Client_information_page_updates"
CHAT_ID_VALUE = "clientInfoTelegramChatId"  # found once from getUpdates, then kept in the database
IST = timezone(timedelta(hours=5, minutes=30))
MAX_MESSAGE_CHARS = 4096

router = APIRouter(prefix="/api/client-info", tags=["client-info-telegram"])
# Telegram carries the bot token in the URL, and httpx logs full URLs at INFO
logging.getLogger("httpx").setLevel(logging.WARNING)


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
        "token": env.get("TELEGRAM_CLIENT_INFO_BOT_TOKEN", ""),
        "chat_id": env.get("TELEGRAM_CLIENT_INFO_CHAT_ID", ""),
        "group_title": env.get("TELEGRAM_CLIENT_INFO_GROUP") or DEFAULT_GROUP_TITLE,
        "public_url": env.get("CRM_PUBLIC_URL", ""),
    }


class TelegramError(RuntimeError):
    def __init__(self, description: str, parameters: Optional[dict] = None):
        super().__init__(description)
        self.parameters = parameters or {}


def _telegram(token: str, method: str, **payload) -> Any:
    try:
        res = httpx.post(f"{TELEGRAM_API}/bot{token}/{method}", json=payload, timeout=15)
        body = res.json()
    except (httpx.HTTPError, ValueError) as err:
        raise TelegramError(f"Telegram is unreachable ({type(err).__name__})") from None
    if not body.get("ok"):
        raise TelegramError(body.get("description") or f"Telegram {method} failed", body.get("parameters"))
    return body.get("result")


# ==========================================
# Which group to post in
# ==========================================
def _groups_seen(token: str) -> list:
    """Groups the bot appears in among its pending updates (kept by Telegram for 24 hours)."""
    found = {}
    for update in _telegram(token, "getUpdates", timeout=0, allowed_updates=["message", "my_chat_member", "channel_post"]):
        for key in ("message", "my_chat_member", "channel_post", "edited_message"):
            chat = (update.get(key) or {}).get("chat") or {}
            if chat.get("type") in ("group", "supergroup"):
                found[chat["id"]] = chat.get("title") or ""
            migrated = (update.get(key) or {}).get("migrate_to_chat_id")
            if migrated:
                found.pop(chat.get("id"), None)
                found[migrated] = chat.get("title") or ""
    return [{"id": cid, "title": title} for cid, title in found.items()]


def _chat_id(cfg: dict) -> str:
    """The group's chat id: from .env, else remembered, else looked up in the bot's recent updates."""
    if cfg["chat_id"]:
        return cfg["chat_id"]
    remembered = store.get_value(CHAT_ID_VALUE)
    if remembered:
        return str(remembered)
    groups = _groups_seen(cfg["token"])
    wanted = cfg["group_title"].strip().lower()
    match = [g for g in groups if g["title"].strip().lower() == wanted] or (groups if len(groups) == 1 else [])
    if not match:
        raise HTTPException(status_code=503, detail=(
            f'The bot has not seen the "{cfg["group_title"]}" group yet. In that group, send '
            "/start@Client_info_page_updates_bot once, then press Send to Review again."))
    store.set_value(CHAT_ID_VALUE, str(match[0]["id"]))
    return str(match[0]["id"])


# ==========================================
# The message
# ==========================================
class ClientInfoAlert(BaseModel):
    saleId: str
    leadId: Optional[str] = ""
    crmUrl: Optional[str] = ""  # ignored: older pages still send it, but the link never comes from the client
    details: dict
    attachmentNames: list = []


def _text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(_text(v) for v in value if _text(v))
    if isinstance(value, dict):  # an uploaded file
        return str(value.get("name") or value.get("fileName") or "attached")
    return str(value).strip()


def _rupees(value) -> str:
    try:
        amount = float(str(value).replace(",", "").replace("₹", ""))
    except (TypeError, ValueError):
        return _text(value)
    whole, paise = f"{amount:.2f}".split(".")
    # Indian grouping: 1,50,847.46
    head, tail = whole[:-3], whole[-3:]
    if head:
        head = re.sub(r"(\d)(?=(\d{2})+$)", r"\1,", head)
        whole = f"{head},{tail}"
    return f"₹{whole}.{paise}"


def ekyc_link(base: str, sale_id: str) -> str:
    return f"{base.split('?')[0].split('#')[0].rstrip('/')}/?{urlencode({'ekyc': sale_id})}"


def _crm_base(cfg: dict) -> str:
    # The link goes to a whole group as a message from our own bot, so its address must come from the
    # server's settings only. A client-sent address would let anyone post a look-alike phishing link.
    parts = urlsplit(cfg["public_url"] or "")
    if parts.scheme in ("http", "https") and parts.hostname and not (parts.username or parts.password):
        return f"{parts.scheme}://{parts.netloc}{parts.path}"
    raise HTTPException(status_code=503, detail="CRM_PUBLIC_URL is not set (or is not an http/https address) in backend/.env.")


def build_message(alert: ClientInfoAlert, submitted_by: str, link: str, now: Optional[datetime] = None) -> str:
    d = alert.details or {}
    e = lambda v: html.escape(_text(v)) or "—"  # noqa: E731
    name = " ".join(p for p in (_text(d.get("clientPrefix")), _text(d.get("clientName"))) if p)
    rows = [
        ("<b>1. Client Identity &amp; Category</b>", None),
        ("PAN Number", d.get("panNumber")),
        ("Client Category", d.get("clientCategory")),
        ("Client Name", name),
    ]
    if _text(d.get("clientCategory")) == "Non-Individual":
        rows += [("Firm Name", d.get("firmName")), ("GSTIN", d.get("gstin")),
                 ("GST Certificate", d.get("gstCertificateFile") or "")]
    rows += [
        ("", None),
        ("<b>2. Contact Information</b>", None),
        ("Email ID", d.get("email")),
        ("Phone Number 1", d.get("phone1")),
        ("Phone Number 2", d.get("phone2") or "—"),
        ("Client State", d.get("clientState")),
        ("", None),
        ("<b>3. Service Subscription &amp; Financials</b>", None),
        ("Payment Date", d.get("paymentDate")),
        ("Service Name", d.get("serviceName")),
        ("Service Tenure", d.get("serviceTenure")),
        ("Transaction No(s)", d.get("transactionNumbers")),
        ("Gross Sales", _rupees(d.get("grossSales"))),
        ("Net Sales", _rupees(d.get("netSales"))),
        ("GST", _rupees(d.get("gst"))),
        ("Transaction Attachments", f"{len(alert.attachmentNames)} file(s)"
         + (f": {', '.join(_text(n) for n in alert.attachmentNames)}" if alert.attachmentNames else "")),
    ]
    stamp = (now or datetime.now(IST)).astimezone(IST).strftime("%d-%m-%Y %H:%M:%S IST")
    lines = ["🆕 <b>Client Information Page: Sent to Review</b>", ""]
    for label, value in rows:
        lines.append(label if value is None else f"<b>{html.escape(label)}:</b> {e(value)}")
    lines += [
        "",
        f"<b>Submitted by:</b> {e(submitted_by)}",
        f"<b>Submitted at:</b> {stamp}",
        f"<b>Sale ID:</b> <code>{e(alert.saleId)}</code>" + (f"  •  <b>Lead ID:</b> <code>{e(alert.leadId)}</code>" if alert.leadId else ""),
        "",
        "🔐 <b>e-KYC &amp; E-Sign</b>",
        f'<a href="{html.escape(link, quote=True)}">Start e-KYC &amp; E-Sign for {e(name or d.get("clientName"))}</a>',
        f"{html.escape(link)}",
        "<i>Opens the CRM (Super Admin sign-in) and sends the Leegality e-KYC &amp; E-Sign request.</i>",
    ]
    text = "\n".join(lines)
    return text if len(text) <= MAX_MESSAGE_CHARS else text[:MAX_MESSAGE_CHARS - 1] + "…"


def _send(cfg: dict, chat_id: str, text: str, link: str) -> dict:
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True,
               "reply_markup": {"inline_keyboard": [[{"text": "🔐 Start e-KYC & E-Sign", "url": link}]]}}
    try:
        return _telegram(cfg["token"], "sendMessage", **payload)
    except TelegramError as err:
        migrated = err.parameters.get("migrate_to_chat_id")
        if migrated:  # the group became a supergroup and has a new id
            if not cfg["chat_id"]:
                store.set_value(CHAT_ID_VALUE, str(migrated))
            return _send(cfg, str(migrated), text, link)
        if "button" in str(err).lower() or "url" in str(err).lower():
            # Telegram refuses some button addresses (e.g. bare IPs); the link in the text still works
            payload.pop("reply_markup")
            return _telegram(cfg["token"], "sendMessage", **payload)
        if "chat not found" in str(err).lower() and not cfg["chat_id"]:
            store.set_value(CHAT_ID_VALUE, None)  # look the group up again next time
        raise


@router.post("/telegram")
def post_client_info(alert: ClientInfoAlert, current_user: dict = Depends(get_current_user)):
    cfg = settings()
    if not cfg["token"]:
        raise HTTPException(status_code=503, detail="TELEGRAM_CLIENT_INFO_BOT_TOKEN is not set in backend/.env")
    if not alert.saleId.strip():
        raise HTTPException(status_code=400, detail="saleId is required")
    link = ekyc_link(_crm_base(cfg), alert.saleId.strip())
    text = build_message(alert, current_user.get("name") or current_user.get("email") or "Executive", link)
    try:
        chat_id = _chat_id(cfg)
        sent = _send(cfg, chat_id, text, link)
    except TelegramError as err:
        raise HTTPException(status_code=502, detail=f"Telegram: {err}") from None
    return {"ok": True, "messageId": sent.get("message_id"), "ekycLink": link}
