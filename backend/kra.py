"""KRA Block: fetch a client's KYC record from CVL KRA and keep the printout on the server.

One client at a time: the block lists the clients from the Client Information page (their sales, with
the PAN entered there) and "Trigger KRA" asks CVL KRA for that PAN. The answer becomes a PDF (the same
details the CVL portal shows under KYC Inquiry > Print), saved in the CRM database (so it is part of the
nightly backups) and downloadable from the block.

Who may use it follows the Feature Access block ('kra-block'); a user only sees and triggers KRA for the
clients they can see anyway (their own team's sales, every sale for Admins).

The CVL connection itself (fetch_from_cvl) is written once the CVL KRA API document is available; until
then Trigger KRA answers 503 with a clear message. Credentials only ever come from backend/.env.
"""
import base64
import io
import os
import re
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Response
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

try:
    from backend import report_style, store
    from backend.auth import get_current_user, is_admin
    from backend.sync import team_ids
except ImportError:
    import report_style
    import store
    from auth import get_current_user, is_admin
    from sync import team_ids


router = APIRouter(prefix="/api/kra", tags=["kra"])

FEATURE_ID = "kra-block"
# Same defaults as the 'kra-block' entry in CRM_FEATURES (src/context/CRMContext.jsx); Feature Access overrides them
DEFAULT_ROLES = {"Super Admin", "Admin"}
RECORDS = "kraRecords"   # one per Trigger KRA: who, when, the KYC status, the file name
FILES = "kraFiles"       # the PDF of each record, base64, same id
IST = timezone(timedelta(hours=5, minutes=30))
PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")

# backend/.env keys for the CVL KRA API
ENV_KEYS = ("CVL_KRA_API_URL", "CVL_KRA_USERNAME", "CVL_KRA_POS_CODE", "CVL_KRA_PASSWORD",
            "CVL_KRA_AES_KEY", "CVL_KRA_API_KEY")


class KraNotAvailable(Exception):
    """CVL KRA cannot be asked right now (not set up, or CVL refused); the message is shown to the user."""


# ==========================================
# CVL KRA connection
# ==========================================
def cvl_settings() -> dict:
    return {key: (os.environ.get(key) or "").strip() for key in ENV_KEYS}


def connector_ready() -> bool:
    """True once the CVL API calls are written and every credential is in backend/.env."""
    return CONNECTOR_IMPLEMENTED and all(cvl_settings().values())


# Flipped to True when fetch_from_cvl is written against the CVL KRA API document
CONNECTOR_IMPLEMENTED = False


def fetch_from_cvl(pan: str) -> List[Tuple[str, str]]:
    """The KYC details CVL KRA holds for this PAN, as (label, value) rows in the portal's order:
    Name, PAN, KRA Name, KYC Date, KYC Status, KYC Status Date, KYC Mode, IPV Flag, address proofs, ...

    Pending the CVL KRA API document (GetPassword, then GetPANStatus / SolicitPANDetailsFetchALLKRA with the
    AES and API keys); the server's IP must also be whitelisted by CVL.
    """
    if not connector_ready():
        raise KraNotAvailable("The CVL KRA connection is not set up yet: it is waiting for the CVL KRA API "
                              "document and the credentials on the server. Nothing was sent to CVL.")
    raise KraNotAvailable("The CVL KRA connection is not available.")


# ==========================================
# Access
# ==========================================
def can_use(user: dict) -> bool:
    """Feature Access first (an explicit on/off for this user), then Super Admin, then the role defaults."""
    entry = store.get("userPermissions", user["id"]) or {}
    explicit = (entry.get("value") or {}).get(FEATURE_ID)
    if isinstance(explicit, bool):
        return explicit
    return user.get("role") in DEFAULT_ROLES


def require_kra(current_user: dict = Depends(get_current_user)) -> dict:
    if not can_use(current_user):
        raise HTTPException(status_code=403, detail="You do not have access to the KRA Block. Ask the Super Admin to enable it in Feature Access.")
    return current_user


def _sale_owner(sale: dict) -> Optional[str]:
    return sale.get("submittedByUserId") or sale.get("employeeId")


def _can_see(user: dict, owner: Optional[str]) -> bool:
    return is_admin(user) or (owner is not None and owner in team_ids(user))


# ==========================================
# PDF
# ==========================================
def render_pdf(client_name: str, pan: str, rows: List[Tuple[str, str]], fetched_at: datetime, fetched_by: str) -> bytes:
    styles = getSampleStyleSheet()
    small = ParagraphStyle("kraSmall", parent=styles["Normal"], fontSize=8.5, textColor=report_style.NOTE)
    cell = ParagraphStyle("kraCell", parent=styles["Normal"], fontSize=9.5, leading=12, textColor=report_style.INK)
    label = ParagraphStyle("kraLabel", parent=cell, fontName="Helvetica-Bold")
    head = report_style.header_style(cell, "Helvetica-Bold")

    when = fetched_at.astimezone(IST).strftime("%d %b %Y %H:%M:%S IST")
    story = [
        report_style.banner("KYC Details - CVL KRA", 170 * mm, "Helvetica-Bold", "Helvetica",
                            [f"{client_name} | PAN {pan}", f"Fetched on {when} by {fetched_by} from CVL KRA (KYC Inquiry)"]),
        Spacer(1, 6 * mm),
    ]
    data = [[Paragraph("Field", head), Paragraph("Value", head)]]
    data += [[Paragraph(escape(str(k)), label), Paragraph(escape(str(v if v not in (None, "") else "-")), cell)]
             for k, v in rows]
    table = Table(data, colWidths=[60 * mm, 110 * mm], repeatRows=1)
    table.setStyle(TableStyle(report_style.table_commands(1) + [
        ("BACKGROUND", (0, 1), (0, -1), report_style.LABEL),
        ("TOPPADDING", (0, 1), (-1, -1), 5), ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
    ]))
    story += [table, Spacer(1, 8 * mm),
              Paragraph("Disclaimer: these details are as held by the KRA on the date above and are for the "
                        "intermediary's KYC records only.", small)]

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                      bottomMargin=16 * mm, title=f"KRA {pan}", author="Astra CRM").build(story)
    return buf.getvalue()


def file_name(client_name: str, pan: str, fetched_at: datetime) -> str:
    safe = re.sub(r"[^A-Za-z0-9]+", "_", client_name or "Client").strip("_") or "Client"
    return f"KRA_{pan}_{safe}_{fetched_at.astimezone(IST):%Y-%m-%d_%H%M}.pdf"


def _find_value(rows: List[Tuple[str, str]], wanted: str) -> str:
    for k, v in rows:
        if str(k).strip().lower() == wanted:
            return str(v or "")
    return ""


# ==========================================
# API
# ==========================================
def _public(record: dict) -> dict:
    return {k: v for k, v in record.items() if k != "ownerId"}


@router.get("/records")
def list_records(current_user: dict = Depends(require_kra)):
    """Every saved KRA the user may see, newest first, and whether Trigger KRA works yet."""
    records = [r for r in store.all(RECORDS) if _can_see(current_user, r.get("ownerId"))]
    records.sort(key=lambda r: r.get("fetchedAt") or "", reverse=True)
    return {"connectorReady": connector_ready(), "records": [_public(r) for r in records]}


@router.post("/sales/{sale_id}/trigger")
def trigger_kra(sale_id: str, current_user: dict = Depends(require_kra)):
    sale = store.get("sales", sale_id)
    if not sale or not _can_see(current_user, _sale_owner(sale)):
        raise HTTPException(status_code=404, detail="That client was not found.")
    info = sale.get("fullClientInfo") or {}
    pan = (sale.get("panNumber") or info.get("panNumber") or "").strip().upper()
    if not PAN_PATTERN.match(pan):
        raise HTTPException(status_code=400, detail="This client has no valid PAN on the Client Information page.")
    client_name = info.get("clientName") or sale.get("contactPerson") or sale.get("clientName") or ""

    try:
        rows = fetch_from_cvl(pan)
    except KraNotAvailable as err:
        raise HTTPException(status_code=503, detail=str(err))

    now = datetime.now(timezone.utc)
    fetched_by = current_user.get("name") or current_user.get("email") or current_user["id"]
    pdf = render_pdf(client_name, pan, rows, now, fetched_by)
    record_id = f"kra-{uuid.uuid4().hex[:12]}"
    record = {
        "id": record_id,
        "saleId": sale_id,
        "pan": pan,
        "clientName": client_name,
        "kycStatus": _find_value(rows, "kyc status"),
        "kraName": _find_value(rows, "kra name"),
        "fetchedAt": now.isoformat(),
        "fetchedById": current_user["id"],
        "fetchedByName": fetched_by,
        "fileName": file_name(client_name, pan, now),
        "ownerId": _sale_owner(sale),
    }
    with store.transaction():
        store.put(FILES, record_id, {"id": record_id, "pdf": base64.b64encode(pdf).decode()})
        store.put(RECORDS, record_id, record)
    return _public(record)


@router.get("/records/{record_id}/pdf")
def download_pdf(record_id: str, current_user: dict = Depends(require_kra)):
    record, file = store.get(RECORDS, record_id), store.get(FILES, record_id)
    if not record or not file or not _can_see(current_user, record.get("ownerId")):
        raise HTTPException(status_code=404, detail="That KRA file was not found.")
    name = record.get("fileName") or f"KRA_{record.get('pan', '')}.pdf"
    return Response(base64.b64decode(file["pdf"]), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=\"{name}\"; filename*=UTF-8''{urllib.parse.quote(name)}"})
