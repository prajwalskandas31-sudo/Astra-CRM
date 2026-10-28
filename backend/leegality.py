"""
Leegality e-KYC & E-Sign integration (Workflow LzfDhWc, template hm6uV8X).

All Leegality traffic goes through this backend so the auth token and private
salt never reach the browser, and requests leave from a whitelisted IP.
Nothing here is simulated: every value returned to the CRM comes from Leegality.
"""
import base64
import hashlib
import hmac
import io
import json
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont

try:
    from backend.auth import require_roles
    from backend.signatures import stored_primary_signature
except ImportError:
    from auth import require_roles
    from signatures import stored_primary_signature


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
TEMPLATE_MAP_PATH = os.path.join(BACKEND_DIR, "leegality_template_map.json")
RECORDS_PATH = os.path.join(BACKEND_DIR, "data", "leegality_documents.json")

router = APIRouter(prefix="/api/leegality", tags=["leegality"])
_records_lock = threading.Lock()


# ==========================================
# Configuration
# ==========================================
def _load_env():
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
    for key in ("LEEGALITY_AUTH_TOKEN", "LEEGALITY_PRIVATE_SALT", "LEEGALITY_BASE_URL"):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def _settings():
    env = _load_env()
    token = env.get("LEEGALITY_AUTH_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="LEEGALITY_AUTH_TOKEN is not set in backend/.env")
    return {
        "token": token,
        "salt": env.get("LEEGALITY_PRIVATE_SALT", ""),
        "base_url": env.get("LEEGALITY_BASE_URL", "https://app1.leegality.com/api").rstrip("/"),
    }


def _template_map():
    with open(TEMPLATE_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)


def _now(tmap):
    return datetime.now(timezone(timedelta(minutes=tmap.get("timezoneOffsetMinutes", 330))))


# ==========================================
# Local record store (backend DB is in-memory, so persist dispatches to disk)
# ==========================================
def _read_records():
    if not os.path.exists(RECORDS_PATH):
        return {}
    with open(RECORDS_PATH, encoding="utf-8") as f:
        return json.load(f)


def _update_record(document_id, patch):
    with _records_lock:
        records = _read_records()
        records[document_id] = {**records.get(document_id, {}), **patch}
        os.makedirs(os.path.dirname(RECORDS_PATH), exist_ok=True)
        with open(RECORDS_PATH, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2)
        return records[document_id]


# ==========================================
# Leegality HTTP
# ==========================================
def _leegality(method, path, settings, **kwargs):
    url = f"{settings['base_url']}{path}"
    try:
        res = httpx.request(method, url, headers={"X-Auth-Token": settings["token"]}, timeout=45, **kwargs)
    except httpx.HTTPError as err:
        raise HTTPException(status_code=502, detail=f"Could not reach Leegality: {err}")
    try:
        body = res.json()
    except ValueError:
        raise HTTPException(status_code=502, detail=f"Leegality returned HTTP {res.status_code} with a non-JSON body: {res.text[:300]}")
    return res.status_code, body


def _messages(body):
    return " | ".join(m.get("message") or m.get("code") or "" for m in (body.get("messages") or [])) or "No message returned"


# ==========================================
# Payload building
# ==========================================
def _tenure_option(tmap, tenure):
    cfg = tmap["tenureCheckbox"]
    normalized = (tenure or "").strip().lower()
    for idx, opt in enumerate(cfg["options"]):
        if normalized in [t.lower() for t in opt["tenures"]]:
            return idx
    allowed = ", ".join(f"{o['label']} = {'/'.join(o['tenures'])}" for o in cfg["options"])
    raise HTTPException(
        status_code=400,
        detail=f"Service Tenure '{tenure}' has no matching option in the agreement's Checkbox 1 ({allowed}). "
               f"Update tenureCheckbox in backend/leegality_template_map.json to map it."
    )


def _field(cfg, **extra):
    field = {"name": cfg["name"], **extra}
    if cfg.get("id"):
        field["id"] = cfg["id"]
    return field


def _decode_image(data_url):
    if not data_url:
        raise HTTPException(
            status_code=400,
            detail="No signature image found. Upload the Primary Signatory signature in the Digital Signature Storage Block first."
        )
    raw = data_url.split(",", 1)[1] if data_url.startswith("data:") else data_url
    try:
        return Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGBA")
    except Exception:
        raise HTTPException(status_code=400, detail="The stored signature could not be read as an image (expected PNG/JPG).")


def _font(size):
    for name in ("arial.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _stamp_signature(signature, stamp_text, width_px, height_px):
    """Render the stored signature with its execution timestamp underneath, sized for the template field."""
    scale = 4  # render at higher resolution so the stamp stays crisp when Leegality scales it
    w, h = int(width_px) * scale, int(height_px) * scale
    text_h = int(h * 0.24)
    canvas = Image.new("RGBA", (w, h), (255, 255, 255, 0))

    sig = signature.copy()
    sig.thumbnail((w, h - text_h - scale * 2), Image.LANCZOS)
    canvas.alpha_composite(sig, ((w - sig.width) // 2, max(0, (h - text_h - sig.height) // 2)))

    draw = ImageDraw.Draw(canvas)
    font = _font(int(text_h * 0.7))
    tw = draw.textlength(stamp_text, font=font)
    draw.text(((w - tw) / 2, h - text_h), stamp_text, fill=(15, 23, 42, 255), font=font)

    out = io.BytesIO()
    canvas.save(out, format="PNG")
    return base64.b64encode(out.getvalue()).decode("ascii")


def _signature_fields(tmap, signature_data_url):
    signature = _decode_image(signature_data_url)
    fields, stamps = [], []
    for cfg in tmap["signatureImageFields"]:
        # Timestamp taken at the moment each placement is generated (24-hour clock)
        stamped_at = _now(tmap)
        label = f"Signed: {stamped_at.strftime(tmap['timestampFormat'])} {tmap.get('timezoneLabel', '')}".strip()
        b64 = _stamp_signature(signature, label, cfg["width"], cfg["height"])
        value = f"data:image/png;base64,{b64}" if tmap.get("signatureImageValue") == "dataUrl" else b64
        fields.append(_field(cfg, type="files", value=value, width=str(cfg["width"]), height=str(cfg["height"])))
        stamps.append({"field": cfg["name"], "timestamp": stamped_at.isoformat(), "label": label})
    return fields, stamps


def _missing_field_ids(tmap):
    missing = []
    if not tmap["dateField"].get("id"):
        missing.append(tmap["dateField"]["name"])
    missing += [f"{tmap['tenureCheckbox']['name']} / {o['name']}" for o in tmap["tenureCheckbox"]["options"] if not o.get("id")]
    missing += [f["name"] for f in tmap["signatureImageFields"] if not f.get("id")]
    return missing


# ==========================================
# Schemas
# ==========================================
class ESignDispatchRequest(BaseModel):
    saleId: str
    clientName: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    serviceTenure: str
    signatureDataUrl: Optional[str] = None
    signatoryName: Optional[str] = None


def _wallet(settings):
    """eSign credit balance straight from Leegality (unused / reserved / consumed / expired / total)."""
    _, body = _leegality("GET", "/v3.0/wallet/balance/details", settings)
    if body.get("status") != 1:
        return {"error": _messages(body)}
    return body.get("data") or {}


# ==========================================
# Endpoints
# ==========================================
@router.get("/status")
def leegality_status(current_user: dict = Depends(require_roles(["Super Admin"]))):
    """Read-only connectivity check: token validity, workflow config and outbound IP."""
    settings = _settings()
    tmap = _template_map()
    # A lookup of a non-existent document costs nothing; 'no.document.found' proves the token + IP are accepted.
    _, body = _leegality("GET", "/v3.1/document/details", settings, params={"documentId": "CRM-CONNECTIVITY-CHECK"})
    codes = [m.get("code") for m in body.get("messages") or []]
    try:
        outbound_ip = httpx.get("https://api.ipify.org", timeout=10).text.strip()
    except httpx.HTTPError:
        outbound_ip = None
    return {
        "tokenAccepted": "no.document.found" in codes,
        "leegalityResponse": _messages(body),
        "outboundIp": outbound_ip,
        "profileId": tmap["profileId"],
        "templateId": tmap["templateId"],
        "fieldsWithoutIds": _missing_field_ids(tmap),
        "webhookSaltConfigured": bool(settings["salt"]),
        "wallet": _wallet(settings),
    }


@router.get("/wallet")
def leegality_wallet(current_user: dict = Depends(require_roles(["Super Admin"]))):
    return _wallet(_settings())


def _delivery_config(document_id, settings):
    """What Leegality actually configured on the new document: notification channels and allowed signature types.
    These come from the workflow, and the create API cannot override them, so read them back after every send."""
    params = {"documentId": document_id, "invitations_inviteeConfigs": "true"}
    _, body = _leegality("GET", "/v3.3/document/details", settings, params=params)
    if body.get("status") != 1:
        return {"error": _messages(body)}
    invitees = []
    for inv in (body.get("data") or {}).get("invitations") or []:
        cfg = inv.get("inviteeConfigs") or {}
        invitees.append({
            "name": inv.get("name"),
            "email": inv.get("email"),
            "phone": inv.get("phone"),
            "emailNotification": bool(cfg.get("emailNotification")),
            "smsNotification": bool(cfg.get("phoneNotification")),
            "whatsAppNotification": bool(cfg.get("whatsAppNotification")),
            "allowedSignatures": inv.get("allowedSignatures") or [],
        })
    return {"invitees": invitees}


@router.post("/esign/dispatch")
def dispatch_esign(req: ESignDispatchRequest, current_user: dict = Depends(require_roles(["Super Admin"]))):
    settings = _settings()
    tmap = _template_map()

    email = (req.email or "").strip()
    phone = "".join(ch for ch in (req.phone or "") if ch.isdigit())[-10:]
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Client email or phone is required on the Client Information Page.")

    option_idx = _tenure_option(tmap, req.serviceTenure)
    executed_at = _now(tmap)

    fields = [_field(tmap["dateField"], type=tmap["dateField"].get("type", "text"), value=executed_at.strftime(tmap["dateField"]["format"]))]
    for idx, opt in enumerate(tmap["tenureCheckbox"]["options"]):
        fields.append(_field(opt, type="checkbox", value=opt["label"], checked=idx == option_idx))
    # The server-stored Primary Signatory wins; the browser's copy is only a fallback until one is stored
    sig_fields, stamps = _signature_fields(tmap, stored_primary_signature() or req.signatureDataUrl)
    fields += sig_fields

    invitee = {"name": req.clientName.strip()}
    if email:
        invitee["email"] = email
    if phone:
        invitee["phone"] = phone

    payload = {
        "profileId": tmap["profileId"],
        "irn": f"CRM-{req.saleId}"[:255],
        "file": {"name": f"RA Terms & Conditions - {req.clientName.strip()}"[:255], "fields": fields},
        "invitees": [invitee],
    }

    http_status, body = _leegality("POST", "/v3.0/sign/request", settings, json=payload)
    if body.get("status") != 1 or not (body.get("data") or {}).get("documentId"):
        raise HTTPException(status_code=422, detail=f"Leegality rejected the request: {_messages(body)}")

    data = body["data"]
    record = _update_record(data["documentId"], {
        "documentId": data["documentId"],
        "saleId": req.saleId,
        "irn": data.get("irn"),
        "profileId": tmap["profileId"],
        "clientName": req.clientName,
        "serviceTenure": req.serviceTenure,
        "tenureOption": tmap["tenureCheckbox"]["options"][option_idx]["label"],
        "date1": executed_at.strftime(tmap["dateField"]["format"]),
        "signatureStamps": stamps,
        "invitees": data.get("invitees") or [],
        "messages": body.get("messages") or [],
        "dispatchedAt": executed_at.isoformat(),
        "dispatchedBy": current_user.get("name"),
        "documentStatus": "SENT",
        "webhookEvents": [],
        "walletAfterDispatch": _wallet(settings),
        "deliveryConfig": _delivery_config(data["documentId"], settings),
        "sentContact": {"email": email or None, "phone": phone or None},
    })
    return record


def _normalize_details(body):
    data = body.get("data") or {}
    doc = data.get("document") or {}
    invitations = []
    for inv in data.get("invitations") or []:
        st = inv.get("invitationStatus") or {}
        invitations.append({
            "name": inv.get("name"),
            "email": inv.get("email"),
            "phone": inv.get("phone"),
            "inviteeType": inv.get("inviteeType"),
            "signUrl": inv.get("invitationUrl"),
            "active": st.get("active"),
            "signed": st.get("signed"),
            "rejected": st.get("rejected"),
            "expired": st.get("expired"),
            "signDate": st.get("signDate"),
            "expiryDate": st.get("expiryDate"),
            "failureReason": st.get("failureReason"),
            "signRejectionMessage": st.get("signRejectionMessage"),
            "usedSignatureType": inv.get("usedSignatureType"),
        })
    return {
        "documentId": doc.get("id"),
        "documentName": doc.get("name"),
        "documentStatus": doc.get("status"),
        "creationDate": doc.get("creationDate"),
        "completionDate": doc.get("completionDate"),
        "invitations": invitations,
    }


@router.get("/esign/{document_id}")
def esign_details(document_id: str, current_user: dict = Depends(require_roles(["Super Admin"]))):
    settings = _settings()
    params = {
        "documentId": document_id,
        "invitations_invitationStatus_failureReason": "true",
        "invitations_invitationStatus_signRejectionMessage": "true",
    }
    _, body = _leegality("GET", "/v3.3/document/details", settings, params=params)
    if body.get("status") != 1:
        raise HTTPException(status_code=404, detail=f"Leegality: {_messages(body)}")
    details = _normalize_details(body)
    record = _read_records().get(document_id)
    if record is not None:
        record = _update_record(document_id, {
            "documentStatus": details["documentStatus"],
            "completionDate": details["completionDate"],
            "lastCheckedAt": datetime.now(timezone.utc).isoformat(),
        })
    return {**details, "crmRecord": record}


def _download(document_id, kind):
    settings = _settings()
    params = {"documentId": document_id, kind: "true"}
    _, body = _leegality("GET", "/v3.3/document/details", settings, params=params)
    if body.get("status") != 1:
        raise HTTPException(status_code=404, detail=f"Leegality: {_messages(body)}")
    doc_status = ((body.get("data") or {}).get("document") or {}).get("status")
    if doc_status != "COMPLETED":
        # Leegality also returns the unsigned PDF for drafts/in-progress documents; never pass that off as signed.
        raise HTTPException(status_code=409, detail=f"Document is {doc_status or 'unknown'}; the signed copy is available only once it is COMPLETED.")
    cdn_url = (body.get("data") or {}).get(kind)
    if not cdn_url:
        raise HTTPException(status_code=409, detail=f"Leegality has no {kind} for this document yet (it is only available once signing is complete).")
    # The CDN link is valid for ~15 seconds, so fetch it immediately.
    pdf = httpx.get(cdn_url, timeout=60)
    if pdf.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Downloading the {kind} from Leegality's CDN failed (HTTP {pdf.status_code}).")
    filename = f"{document_id}_{'signed' if kind == 'file' else 'audit_trail'}.pdf"
    return Response(content=pdf.content, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/esign/{document_id}/signed-pdf")
def esign_signed_pdf(document_id: str, current_user: dict = Depends(require_roles(["Super Admin"]))):
    return _download(document_id, "file")


@router.get("/esign/{document_id}/audit-trail")
def esign_audit_trail(document_id: str, current_user: dict = Depends(require_roles(["Super Admin"]))):
    return _download(document_id, "auditTrail")


@router.post("/webhook")
async def leegality_webhook(request: Request):
    """Receives Leegality signer events. Requires a public HTTPS URL configured on the workflow's invitee."""
    payload = await request.json()
    document_id = payload.get("documentId") or ""
    settings = _settings()
    expected = hmac.new(settings["salt"].encode(), document_id.encode(), hashlib.sha1).hexdigest()
    if not settings["salt"] or not hmac.compare_digest(expected, payload.get("mac") or ""):
        raise HTTPException(status_code=401, detail="Webhook MAC verification failed")

    record = _read_records().get(document_id, {"documentId": document_id})
    events = record.get("webhookEvents", []) + [{"receivedAt": datetime.now(timezone.utc).isoformat(), **payload}]
    _update_record(document_id, {
        "documentStatus": (payload.get("documentStatus") or "").upper() or record.get("documentStatus"),
        "webhookEvents": events[-20:],
    })
    return {"received": True}
