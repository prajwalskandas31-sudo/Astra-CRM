"""Email Block: the Sender Email ID, the Welcome Kit files and sending the Welcome Kit to a client.

The Super Admin sets the address the CRM sends from (with the SMTP login for that mailbox) and uploads
up to 19 Welcome Kit files. "Send Welcome Kit" emails the client from that address with every uploaded
file attached; empty slots are skipped. When the client has completed the Leegality e-sign, the signed
agreement is fetched from Leegality and attached as well.

Everything here stays on the server: the SMTP password is never returned to a browser, the files are
not part of the synced CRM data, and the recipient is read from the sale, not taken from the request.
"""
import base64
import re
import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

try:
    from backend import store
    from backend.auth import require_roles
    from backend import leegality
except ImportError:
    import store
    from auth import require_roles
    import leegality


router = APIRouter(prefix="/api/email", tags=["email"])

SETTINGS = "emailSettings"
SLOTS = "welcomeKitSlots"          # {slot number: file metadata}
FILE_PREFIX = "welcomeKitFile:"    # one value per slot holding the file itself
LOG = "welcomeKitLog"
SLOT_COUNT = 19
MAX_FILE_BYTES = 10 * 1024 * 1024
# Mail servers cap a whole message at about 25 MB *after* base64 (+33%), and the signed agreement
# still has to fit, so the uploaded files together stay under 15 MB.
MAX_TOTAL_BYTES = 15 * 1024 * 1024
LOG_LIMIT = 500

EMAIL_RE = re.compile(r"^[^@\s<>\"',;]+@[^@\s<>\"',;]+\.[^@\s<>\"',;]+$")
SECURITY_MODES = {"ssl", "starttls", "none"}

DEFAULT_SUBJECT = "Welcome to {companyName}"
DEFAULT_BODY = (
    "Dear {clientName},\n\n"
    "Welcome to {companyName}. Please find your Welcome Kit attached to this email.\n\n"
    "If you have any questions, simply reply to this email.\n\n"
    "Warm regards,\n{companyName}"
)
DEFAULTS = {
    "senderEmail": "",
    "senderName": "",
    "smtpHost": "",
    "smtpPort": 465,
    "smtpSecurity": "ssl",
    "smtpUsername": "",
    "smtpPassword": "",
    "subject": DEFAULT_SUBJECT,
    "body": DEFAULT_BODY,
}

read_roles = require_roles(["Super Admin", "Admin"])
write_roles = require_roles(["Super Admin"])


# ==========================================
# Settings
# ==========================================
def _settings() -> dict:
    return {**DEFAULTS, **(store.get_value(SETTINGS, {}) or {})}


def _public(settings: dict) -> dict:
    out = {k: v for k, v in settings.items() if k != "smtpPassword"}
    out["passwordSet"] = bool(settings.get("smtpPassword"))
    return out


def _one_line(value: str) -> str:
    # Header values: a line break would let the text start a new header
    return " ".join((value or "").split())


class EmailSettingsUpdate(BaseModel):
    senderEmail: Optional[str] = None
    senderName: Optional[str] = None
    smtpHost: Optional[str] = None
    smtpPort: Optional[int] = None
    smtpSecurity: Optional[str] = None
    smtpUsername: Optional[str] = None
    smtpPassword: Optional[str] = None  # blank keeps the saved one
    subject: Optional[str] = None
    body: Optional[str] = None


@router.get("/settings")
def get_settings(current_user: dict = Depends(read_roles)):
    return {**_public(_settings()), "slotCount": SLOT_COUNT, "maxFileBytes": MAX_FILE_BYTES, "maxTotalBytes": MAX_TOTAL_BYTES}


@router.put("/settings")
def update_settings(req: EmailSettingsUpdate, current_user: dict = Depends(write_roles)):
    changes = req.model_dump(exclude_none=True)
    if "senderEmail" in changes:
        changes["senderEmail"] = changes["senderEmail"].strip().lower()
        if changes["senderEmail"] and not EMAIL_RE.match(changes["senderEmail"]):
            raise HTTPException(status_code=400, detail="Sender Email ID is not a valid email address.")
    for key in ("senderName", "smtpUsername", "subject"):
        if key in changes:
            changes[key] = _one_line(changes[key])
    if "smtpHost" in changes:
        changes["smtpHost"] = changes["smtpHost"].strip().lower()
        if changes["smtpHost"] and not re.match(r"^[a-z0-9.-]+$", changes["smtpHost"]):
            raise HTTPException(status_code=400, detail="SMTP Server must be a host name such as smtp.gmail.com.")
    if "smtpPort" in changes and not 1 <= changes["smtpPort"] <= 65535:
        raise HTTPException(status_code=400, detail="SMTP Port must be between 1 and 65535.")
    if "smtpSecurity" in changes and changes["smtpSecurity"] not in SECURITY_MODES:
        raise HTTPException(status_code=400, detail="Security must be ssl, starttls or none.")
    if not changes.get("smtpPassword"):
        changes.pop("smtpPassword", None)
    if "body" in changes and len(changes["body"]) > 20000:
        raise HTTPException(status_code=400, detail="The email message is too long (20,000 characters at most).")

    with store.update_value(SETTINGS, {}) as box:
        box[0] = {**(box[0] or {}), **changes, "updatedAt": _now(), "updatedBy": current_user.get("name")}
        saved = {**DEFAULTS, **box[0]}
    return _public(saved)


@router.delete("/settings/password")
def clear_password(current_user: dict = Depends(write_roles)):
    with store.update_value(SETTINGS, {}) as box:
        box[0] = {**(box[0] or {}), "smtpPassword": ""}
        saved = {**DEFAULTS, **box[0]}
    return _public(saved)


# ==========================================
# Welcome Kit files (19 slots)
# ==========================================
def _slot_or_404(slot: int) -> str:
    if not 1 <= slot <= SLOT_COUNT:
        raise HTTPException(status_code=404, detail=f"Welcome Kit slots are numbered 1 to {SLOT_COUNT}.")
    return str(slot)


def _slots() -> dict:
    return store.get_value(SLOTS, {}) or {}


def _slot_list(slots: dict) -> list:
    return [{"slot": n, **(slots.get(str(n)) or {})} | {"filled": str(n) in slots} for n in range(1, SLOT_COUNT + 1)]


class SlotUpload(BaseModel):
    fileName: str
    contentType: Optional[str] = ""
    dataBase64: str


def _safe_filename(name: str) -> str:
    name = re.sub(r"[\\/\r\n\t\x00-\x1f\"]", "_", (name or "").strip()).strip(". ")
    return name[:180] or "attachment"


@router.get("/welcome-kit/files")
def list_files(current_user: dict = Depends(read_roles)):
    slots = _slots()
    return {"slots": _slot_list(slots), "totalBytes": sum(m.get("size", 0) for m in slots.values()),
            "maxFileBytes": MAX_FILE_BYTES, "maxTotalBytes": MAX_TOTAL_BYTES}


@router.put("/welcome-kit/files/{slot}")
def upload_file(slot: int, req: SlotUpload, current_user: dict = Depends(write_roles)):
    key = _slot_or_404(slot)
    raw_b64 = req.dataBase64.split(",", 1)[1] if req.dataBase64.startswith("data:") else req.dataBase64
    if len(raw_b64) > (MAX_FILE_BYTES * 4) // 3 + 8:
        raise HTTPException(status_code=413, detail=f"Each file can be at most {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    try:
        content = base64.b64decode(raw_b64, validate=True)
    except ValueError:
        raise HTTPException(status_code=400, detail="The file could not be read (invalid base64).")
    if not content:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"Each file can be at most {MAX_FILE_BYTES // (1024 * 1024)} MB.")

    content_type = (req.contentType or "").strip().lower()
    if not re.match(r"^[a-z0-9.+-]+/[a-z0-9.+-]+$", content_type):
        content_type = "application/octet-stream"
    meta = {"fileName": _safe_filename(req.fileName), "contentType": content_type, "size": len(content),
            "uploadedAt": _now(), "uploadedBy": current_user.get("name"), "fileId": uuid.uuid4().hex}

    with store.update_value(SLOTS, {}) as box:
        slots = box[0] or {}
        others = sum(m.get("size", 0) for k, m in slots.items() if k != key)
        if others + len(content) > MAX_TOTAL_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"All Welcome Kit files together can be at most {MAX_TOTAL_BYTES // (1024 * 1024)} MB, so the email "
                       f"still fits mail-server limits with the signed agreement. Remove or shrink another file first.")
        store.set_value(FILE_PREFIX + key, {"fileId": meta["fileId"], "data": base64.b64encode(content).decode("ascii")})
        slots[key] = meta
        box[0] = slots
    return {"slot": slot, "filled": True, **meta}


@router.delete("/welcome-kit/files/{slot}")
def delete_file(slot: int, current_user: dict = Depends(write_roles)):
    key = _slot_or_404(slot)
    with store.update_value(SLOTS, {}) as box:
        slots = box[0] or {}
        slots.pop(key, None)
        box[0] = slots
        store.delete("kv", FILE_PREFIX + key)
    return {"slot": slot, "filled": False}


def _slot_content(key: str, meta: dict) -> bytes:
    stored = store.get_value(FILE_PREFIX + key) or {}
    if stored.get("fileId") != meta.get("fileId") or not stored.get("data"):
        raise HTTPException(status_code=500, detail=f"Welcome Kit file {key} ({meta.get('fileName')}) is missing; upload it again.")
    return base64.b64decode(stored["data"])


@router.get("/welcome-kit/files/{slot}")
def download_file(slot: int, current_user: dict = Depends(read_roles)):
    key = _slot_or_404(slot)
    meta = _slots().get(key)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Slot {slot} is empty.")
    return Response(content=_slot_content(key, meta), media_type=meta.get("contentType") or "application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="{meta["fileName"]}"'})


# ==========================================
# Sending
# ==========================================
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _company_name() -> str:
    doc = store.get("companyProfile", "companyName") or {}
    return (doc.get("value") or "").strip() or "our company"


def _sale_or_404(sale_id: str) -> dict:
    sale = store.get("sales", sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found.")
    return sale


def _client(sale: dict) -> dict:
    info = sale.get("fullClientInfo") or sale.get("clientInfo") or {}
    email = (sale.get("email") or info.get("email") or "").strip()
    name = (info.get("clientName") or sale.get("clientName") or "").strip()
    return {"name": name, "email": email, "emailValid": bool(EMAIL_RE.match(email))}


def _agreement_document_id(sale: dict) -> Optional[str]:
    explicit = sale.get("eSignDocumentId") or (sale.get("eSignDetails") or {}).get("documentId")
    if explicit:
        return explicit
    docs = leegality.documents_for_sale(sale["id"])
    return docs[0]["documentId"] if docs else None


def _render(template: str, values: dict) -> str:
    # Plain replacement (not str.format) so stray braces in the admin's text never break sending
    for key, val in values.items():
        template = template.replace("{" + key + "}", val)
    return template


def _require_sender(settings: dict):
    missing = [label for label, key in (("Sender Email ID", "senderEmail"), ("SMTP Server", "smtpHost"),
                                        ("SMTP Password", "smtpPassword")) if not settings.get(key)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Set the {', '.join(missing)} in the Email Block's Sender Email ID section first.")


def _smtp_send(settings: dict, message: EmailMessage):
    host, port, mode = settings["smtpHost"], int(settings["smtpPort"]), settings["smtpSecurity"]
    username = settings.get("smtpUsername") or settings["senderEmail"]
    context = ssl.create_default_context()
    try:
        if mode == "ssl":
            server = smtplib.SMTP_SSL(host, port, timeout=60, context=context)
        else:
            server = smtplib.SMTP(host, port, timeout=60)
        with server:
            if mode == "starttls":
                server.starttls(context=context)
            server.login(username, settings["smtpPassword"])
            refused = server.send_message(message)
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=502, detail=f"The mail server rejected the login for {username}. Check the SMTP username and "
                                                    f"password (Gmail and Microsoft 365 need an App Password, not the normal one).")
    except smtplib.SMTPSenderRefused:
        raise HTTPException(status_code=502, detail=f"The mail server would not send as {settings['senderEmail']}. The Sender Email ID must be "
                                                    f"the SMTP account itself or an alias that account is allowed to send as.")
    except smtplib.SMTPRecipientsRefused:
        raise HTTPException(status_code=502, detail="The mail server refused the client's email address.")
    except (smtplib.SMTPException, OSError) as err:
        raise HTTPException(status_code=502, detail=f"Could not send through {host}:{port} ({mode}): {err}")
    if refused:
        raise HTTPException(status_code=502, detail=f"The mail server refused: {', '.join(refused)}.")


def _message(settings: dict, to_email: str, subject: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((_one_line(settings.get("senderName") or ""), settings["senderEmail"]))
    msg["To"] = to_email
    msg["Subject"] = _one_line(subject)
    msg["Message-ID"] = make_msgid(domain=settings["senderEmail"].split("@", 1)[1])
    msg.set_content(body)
    return msg


class WelcomeKitSend(BaseModel):
    saleId: str


@router.get("/welcome-kit/preview/{sale_id}")
def preview(sale_id: str, current_user: dict = Depends(read_roles)):
    """What a send would do, from the CRM's own records (Leegality itself is asked only when sending)."""
    sale = _sale_or_404(sale_id)
    slots = _slots()
    doc_id = _agreement_document_id(sale)
    record = leegality._read_records().get(doc_id, {}) if doc_id else {}
    signed = sale.get("eSignStatus") == "Completed" or record.get("documentStatus") == "COMPLETED"
    last = next((e for e in reversed(store.get_value(LOG, []) or []) if e.get("saleId") == sale_id), None)
    return {
        "client": _client(sale),
        "from": _settings().get("senderEmail"),
        "files": [{"slot": int(k), **m} for k, m in sorted(slots.items(), key=lambda kv: int(kv[0]))],
        "agreement": {"documentId": doc_id, "signed": signed, "status": record.get("documentStatus")},
        "lastSent": last,
    }


@router.post("/welcome-kit/send")
def send_welcome_kit(req: WelcomeKitSend, current_user: dict = Depends(read_roles)):
    settings = _settings()
    _require_sender(settings)
    sale = _sale_or_404(req.saleId)
    client = _client(sale)
    if not client["email"]:
        raise HTTPException(status_code=400, detail="This client has no Email ID on the Client Information Page.")
    if not client["emailValid"]:
        raise HTTPException(status_code=400, detail=f"The client's Email ID '{client['email']}' is not a valid address.")

    # Uploaded files, in slot order; empty slots are simply not there
    slots = _slots()
    attachments = []
    for key, meta in sorted(slots.items(), key=lambda kv: int(kv[0])):
        attachments.append((meta["fileName"], meta.get("contentType") or "application/octet-stream", _slot_content(key, meta)))

    # The signed agreement, straight from Leegality. If a document exists but Leegality cannot be asked,
    # fail instead of sending a kit that silently lacks the agreement.
    doc_id = _agreement_document_id(sale)
    agreement = {"documentId": doc_id, "attached": False, "status": None}
    if doc_id:
        status, pdf = leegality.fetch_completed_pdf(doc_id, "file")
        agreement["status"] = status
        if pdf:
            safe_client = _safe_filename(client["name"] or "Client")
            attachments.append((f"Signed Agreement - {safe_client}.pdf", "application/pdf", pdf))
            agreement["attached"] = True

    if not attachments:
        raise HTTPException(status_code=400, detail="Nothing to send: no Welcome Kit files are uploaded and the client has not completed the e-sign.")

    values = {"clientName": client["name"] or "Client", "companyName": _company_name()}
    msg = _message(settings, client["email"], _render(settings["subject"], values), _render(settings["body"], values))
    for name, content_type, content in attachments:
        maintype, subtype = content_type.split("/", 1)
        msg.add_attachment(content, maintype=maintype, subtype=subtype, filename=name)

    _smtp_send(settings, msg)

    entry = {
        "id": uuid.uuid4().hex,
        "saleId": req.saleId,
        "clientName": client["name"],
        "to": client["email"],
        "from": settings["senderEmail"],
        "attachments": [a[0] for a in attachments],
        "agreementAttached": agreement["attached"],
        "agreementDocumentId": doc_id,
        "agreementStatus": agreement["status"],
        "sentAt": _now(),
        "sentBy": current_user.get("name"),
    }
    with store.update_value(LOG, []) as box:
        box[0] = (box[0] or [])[-(LOG_LIMIT - 1):] + [entry]
    return entry


@router.get("/welcome-kit/log")
def send_log(current_user: dict = Depends(read_roles)):
    return list(reversed(store.get_value(LOG, []) or []))[:100]


class TestEmail(BaseModel):
    to: Optional[str] = None


@router.post("/test")
def send_test(req: TestEmail, current_user: dict = Depends(write_roles)):
    """Proves the sender settings work by mailing the Sender Email ID (or the given address)."""
    settings = _settings()
    _require_sender(settings)
    to = (req.to or settings["senderEmail"]).strip()
    if not EMAIL_RE.match(to):
        raise HTTPException(status_code=400, detail="Test recipient is not a valid email address.")
    msg = _message(settings, to, "CRM test email",
                   f"This is a test email from the CRM, sent from {settings['senderEmail']}.\n\n"
                   f"Welcome Kits to clients will be sent from this address.")
    _smtp_send(settings, msg)
    return {"sent": True, "to": to, "from": settings["senderEmail"]}
