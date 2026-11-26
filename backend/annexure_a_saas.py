"""Annexure A for SaaS Reporting: a manual input sheet in the layout of the "Annexure A" format.

The format (backend/templates/annexure_a_saas/, the client's Word file unzipped) is one table and a sign-off:

  Annexure A
  SN | IA/RA Enlistment Number | IA/RA Name | Whether using any SaaS based solutions (Yes / No) |
     Name of SaaS/ Hosted Service | Type (SaaS or Hosted Service) | Critical/ non-critical |
     Location of hosting of SaaS/ Hosted Service (Within India/ Outside India) | Comments (if any)
  (16 numbered rows)
  With Regards / ________________ / c.c.: BSE Ltd., 25th Floor, P. J. Towers, Fort, Mumbai 400 023.

Nothing is fetched from the rest of the CRM: every value is typed in by the user. A user can keep several
reports (e.g. one per submission); each starts with the format's 16 blank rows, rows can be added or
removed, and SN is the row's position. The Signatory name / designation (printed under the signature line)
are optional; left blank, the sign-off is exactly as in the format. The c.c. block starts as in the format
and can be edited.

Downloads: Word (the original template filled in, so fonts, borders and margins match), PDF and, in the
browser, Excel. Who may use it is the "annexure-a-saas" feature in the Feature Access Block (Super Admin
by default).
"""
import io
import re
import uuid
import zipfile
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from xml.sax.saxutils import escape

from fastapi import APIRouter, Body, Depends, HTTPException, Response

try:
    from backend import store, invoice
    from backend.auth import get_current_user
    from backend.running_account import IST
except ImportError:
    import store
    import invoice
    from auth import get_current_user
    from running_account import IST


FEATURE_ID = "annexure-a-saas"
DEFAULT_ROLES = ("Super Admin",)  # kept in step with CRM_FEATURES in CRMContext.jsx
COLLECTION = "annexureASaas"      # server-only (not in sync.POLICIES)
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates" / "annexure_a_saas"

TITLE = "Annexure A"
TEMPLATE_ROWS = 16
MAX_ROWS = 500
MAX_LABEL = 120
MAX_TEXT = 300
MAX_COMMENTS = 2000
MAX_CC = 1000
DEFAULT_CC = "BSE Ltd.\n25th Floor, P. J. Towers, Fort\nMumbai 400 023."

# The table's columns after SN, in the format's order and wording. kind "choice" = one of `options` (or blank).
COLUMNS = (
    {"key": "enlistmentNumber", "title": "IA/RA Enlistment Number", "kind": "text"},
    {"key": "iaRaName", "title": "IA/RA Name", "kind": "text"},
    {"key": "usingSaas", "title": "Whether using any SaaS based solutions (Yes / No)", "kind": "choice",
     "options": ["Yes", "No"]},
    {"key": "serviceName", "title": "Name of SaaS/ Hosted Service", "kind": "text"},
    {"key": "serviceType", "title": "Type (SaaS or Hosted Service)", "kind": "choice", "options": ["SaaS", "Hosted Service"]},
    {"key": "criticality", "title": "Critical/ non-critical", "kind": "choice", "options": ["Critical", "Non-critical"]},
    {"key": "hostingLocation", "title": "Location of hosting of SaaS/ Hosted Service (Within India/ Outside India)",
     "kind": "choice", "options": ["Within India", "Outside India"]},
    {"key": "comments", "title": "Comments (if any)", "kind": "textarea"},
)
COLUMN_KEYS = [c["key"] for c in COLUMNS]
HEADER = ["SN"] + [c["title"] for c in COLUMNS]

router = APIRouter(prefix="/api/annexure-a-saas", tags=["annexure-a-saas"])


# ==========================================
# Access
# ==========================================
def _allowed(user: dict) -> bool:
    perms = (store.get("userPermissions", user["id"]) or {}).get("value")
    if isinstance(perms, dict) and isinstance(perms.get(FEATURE_ID), bool):
        return perms[FEATURE_ID]
    return user.get("role") in DEFAULT_ROLES


def require_access(current_user: dict = Depends(get_current_user)) -> dict:
    if not _allowed(current_user):
        raise HTTPException(status_code=403, detail="You do not have access to Annexure A for SaaS Reporting.")
    return current_user


# ==========================================
# Records
# ==========================================
def blank_row() -> dict:
    return {k: "" for k in COLUMN_KEYS}


def _text(value, limit: int, multiline: bool = False) -> str:
    s = str(value if value is not None else "").replace("\r\n", "\n").replace("\r", "\n")
    if not multiline:
        s = " ".join(s.split())
    return s.strip()[:limit]


def _choice(col: dict, value, row_no: int) -> str:
    s = _text(value, MAX_TEXT)
    if not s:
        return ""
    for option in col["options"]:
        if s.lower() == option.lower():
            return option
    raise HTTPException(status_code=400, detail=f"Row {row_no}: {col['title']} must be {' or '.join(col['options'])}.")


def clean_rows(raw) -> list:
    if not isinstance(raw, list) or not raw:
        raise HTTPException(status_code=400, detail="The report needs at least one row.")
    if len(raw) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"A report can have at most {MAX_ROWS} rows.")
    rows = []
    for i, r in enumerate(raw, start=1):
        r = r if isinstance(r, dict) else {}
        row = {}
        for col in COLUMNS:
            if col["kind"] == "choice":
                row[col["key"]] = _choice(col, r.get(col["key"]), i)
            elif col["kind"] == "textarea":
                row[col["key"]] = _text(r.get(col["key"]), MAX_COMMENTS, multiline=True)
            else:
                row[col["key"]] = _text(r.get(col["key"]), MAX_TEXT)
        rows.append(row)
    return rows


def _label(value) -> str:
    label = _text(value, MAX_LABEL)
    if not label:
        raise HTTPException(status_code=400, detail="Give the report a name (e.g. SaaS Reporting - Nov 2026).")
    return label


def _now() -> str:
    return datetime.now(IST).isoformat()


def _filled(row: dict) -> bool:
    return any(str(row.get(k) or "").strip() for k in COLUMN_KEYS)


def summary(doc: dict) -> dict:
    rows = doc.get("rows") or []
    return {"id": doc["id"], "label": doc.get("label", ""), "rowCount": len(rows),
            "filledRows": sum(1 for r in rows if _filled(r)), "createdAt": doc.get("createdAt", ""),
            "updatedAt": doc.get("updatedAt", ""), "updatedBy": doc.get("updatedBy", "")}


def _get(report_id: str) -> dict:
    doc = store.get(COLLECTION, report_id)
    if not doc:
        raise HTTPException(status_code=404, detail="That report no longer exists.")
    return doc


def schema() -> dict:
    return {"title": TITLE, "columns": list(COLUMNS), "templateRows": TEMPLATE_ROWS, "maxRows": MAX_ROWS,
            "defaultCc": DEFAULT_CC, "signOff": "With Regards"}


# ==========================================
# Routes
# ==========================================
@router.get("")
def list_reports(current_user: dict = Depends(require_access)):
    reports = sorted((summary(d) for d in store.all(COLLECTION)), key=lambda s: s["updatedAt"], reverse=True)
    return {"reports": reports, "schema": schema()}


@router.post("")
def create_report(body: dict = Body(...), current_user: dict = Depends(require_access)):
    """body: {"label": "...", "copyFrom": "<report id>" (optional: start from a copy of that report)}."""
    body = body or {}
    label = _label(body.get("label"))
    doc = {"rows": [blank_row() for _ in range(TEMPLATE_ROWS)], "signatoryName": "", "signatoryDesignation": "",
           "cc": DEFAULT_CC}
    if body.get("copyFrom"):
        src = _get(str(body["copyFrom"]))
        doc = {k: src.get(k, doc[k]) for k in doc}
    now = _now()
    doc.update(id=uuid.uuid4().hex, label=label, createdAt=now, createdBy=current_user.get("name", ""),
               updatedAt=now, updatedBy=current_user.get("name", ""))
    store.put(COLLECTION, doc["id"], doc)
    return doc


@router.get("/{report_id}")
def get_report(report_id: str, current_user: dict = Depends(require_access)):
    return _get(report_id)


@router.put("/{report_id}")
def save_report(report_id: str, body: dict = Body(...), current_user: dict = Depends(require_access)):
    """body: {"label", "rows": [...], "signatoryName", "signatoryDesignation", "cc", "updatedAt": <as loaded>}.

    updatedAt is the version the user was editing: if someone saved the report since, nothing is written (409).
    """
    body = body or {}
    with store.transaction():
        doc = _get(report_id)
        if body.get("updatedAt") and body["updatedAt"] != doc.get("updatedAt"):
            who = doc.get("updatedBy") or "someone else"
            raise HTTPException(status_code=409, detail=f"{who} saved this report after you opened it. Reload it, then make your changes again.")
        doc.update(
            label=_label(body.get("label", doc.get("label"))),
            rows=clean_rows(body.get("rows")),
            signatoryName=_text(body.get("signatoryName"), MAX_TEXT),
            signatoryDesignation=_text(body.get("signatoryDesignation"), MAX_TEXT),
            cc=_text(body.get("cc"), MAX_CC, multiline=True),
            updatedAt=_now(), updatedBy=current_user.get("name", ""),
        )
        store.put(COLLECTION, report_id, doc)
    return doc


@router.delete("/{report_id}")
def delete_report(report_id: str, current_user: dict = Depends(require_access)):
    if not store.delete(COLLECTION, report_id):
        raise HTTPException(status_code=404, detail="That report no longer exists.")
    return {"deleted": report_id}


def _filename(doc: dict, ext: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]+', " ", doc.get("label") or "").strip() or "Report"
    return f"Annexure A for SaaS Reporting - {safe}.{ext}"


def _attachment(content: bytes, media_type: str, filename: str) -> Response:
    ascii_name = filename.encode("ascii", "ignore").decode() or "Annexure A.bin"
    return Response(content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{ascii_name}"'})


@router.get("/{report_id}/docx")
def download_docx(report_id: str, current_user: dict = Depends(require_access)):
    doc = _get(report_id)
    return _attachment(build_docx(doc), "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                       _filename(doc, "docx"))


@router.get("/{report_id}/pdf")
def download_pdf(report_id: str, current_user: dict = Depends(require_access)):
    doc = _get(report_id)
    return _attachment(build_pdf(doc), "application/pdf", _filename(doc, "pdf"))


# ==========================================
# Word: the original template, filled in
# ==========================================
@lru_cache(maxsize=1)
def _template() -> dict:
    """The template's parts, {name inside the .docx: bytes}, [Content_Types].xml first."""
    parts = {}
    for path in sorted(TEMPLATE_DIR.rglob("*"), key=lambda p: (p.name != "[Content_Types].xml", str(p))):
        if path.is_file():
            parts[path.relative_to(TEMPLATE_DIR).as_posix()] = path.read_bytes()
    if "word/document.xml" not in parts:
        raise RuntimeError(f"Annexure A template missing from {TEMPLATE_DIR}")
    return parts


def _runs(text: str, rpr: str) -> str:
    """Text as Word runs in the given run properties; line breaks become <w:br/>."""
    lines = (text or "").split("\n")
    body = '<w:br/>'.join(f'<w:t xml:space="preserve">{escape(line)}</w:t>' for line in lines)
    return f"<w:r>{rpr}{body}</w:r>"


def _paragraph_at(xml: str, marker: str) -> tuple:
    """(start, end) of the <w:p> that contains marker."""
    at = xml.index(marker)
    start = xml.rfind("<w:p ", 0, at)
    end = xml.index("</w:p>", at) + len("</w:p>")
    return start, end


def _fill_document(xml: str, doc: dict) -> str:
    t0 = xml.index("<w:tbl>")
    t1 = xml.index("</w:tbl>", t0)
    table = xml[t0:t1]
    trs = re.findall(r"<w:tr\b.*?</w:tr>", table, re.S)
    header, template_row = trs[0], trs[1]

    # The header repeats on every page when the rows run past the first
    header_out = header.replace("<w:trPr>", "<w:trPr><w:tblHeader/>", 1)

    # One data row as a pattern: no paragraph ids (they must be unique), wrapping allowed for typed text
    pattern = re.sub(r' w14:(paraId|textId)="[^"]*"', "", template_row).replace("<w:noWrap/>", "")
    row_open = pattern[:pattern.index("<w:tc>")]
    cells = re.findall(r"<w:tc>.*?</w:tc>", pattern, re.S)
    if len(cells) != len(HEADER):
        raise RuntimeError("Annexure A template table does not have the expected columns")

    out_rows = []
    for n, row in enumerate(doc.get("rows") or [], start=1):
        out = [cells[0].replace("<w:t>1</w:t>", f"<w:t>{n}</w:t>", 1)]
        for cell, key in zip(cells[1:], COLUMN_KEYS):
            value = str(row.get(key) or "")
            if value:
                rpr = re.search(r"<w:pPr>.*?(<w:rPr>.*?</w:rPr>)</w:pPr>", cell, re.S)
                rpr = rpr.group(1) if rpr else ""
                cell = cell[:cell.rindex("</w:p>")] + _runs(value, rpr) + cell[cell.rindex("</w:p>"):]
            out.append(cell)
        out_rows.append(row_open + "".join(out) + "</w:tr>")

    first_tr = table.index("<w:tr")
    xml = xml[:t0] + table[:first_tr] + header_out + "".join(out_rows) + xml[t1:]

    # Sign-off: optional signatory name / designation under the signature line, then the c.c. block
    s, e = _paragraph_at(xml, "________________")
    line_para = xml[s:e]
    extra = ""
    for value in (doc.get("signatoryName"), doc.get("signatoryDesignation")):
        if value:
            p = re.sub(r' w14:(paraId|textId)="[^"]*"', "", line_para)
            p = re.sub(r"<w:t>________________</w:t>", f'<w:t xml:space="preserve">{escape(value)}</w:t>', p)
            extra += p
    xml = xml[:e] + extra + xml[e:]

    s, e = _paragraph_at(xml, "c.c.:")
    para = xml[s:e]
    cc = [line.strip() for line in str(doc.get("cc") or "").split("\n") if line.strip()]
    if not cc:
        xml = xml[:s] + xml[e:]
    else:
        first_run = re.search(r"<w:r\b[^>]*>(<w:rPr>.*?</w:rPr>)", para, re.S)
        rpr = first_run.group(1) if first_run else ""
        runs = "".join(f'<w:r>{rpr}<w:br/><w:t xml:space="preserve">{escape(("c.c.:   " if i == 0 else "") + line)}</w:t></w:r>'
                       for i, line in enumerate(cc))
        body_start = para.index("</w:pPr>") + len("</w:pPr>")
        xml = xml[:s] + para[:body_start] + runs + "</w:p>" + xml[e:]
    return xml


def build_docx(doc: dict) -> bytes:
    parts = dict(_template())
    parts["word/document.xml"] = _fill_document(parts["word/document.xml"].decode("utf-8"), doc).encode("utf-8")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts.items():
            z.writestr(name, data)
    return buf.getvalue()


# ==========================================
# PDF: the same page (A4 portrait, 0.5" margins, the table's column widths)
# ==========================================
TEMPLATE_WIDTHS = (475, 1198, 917, 1406, 1466, 939, 945, 1551, 1878)  # <w:tblGrid> of the template, in twips


def build_pdf(doc: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    regular, bold, _ = invoice._fonts()
    margin = 12.7 * mm
    usable = A4[0] - 2 * margin
    try:
        from backend import report_style
    except ImportError:
        import report_style
    head = ParagraphStyle("head", fontName=bold, fontSize=8.5, leading=10.5, alignment=1, textColor=colors.white)
    # A 12-character enlistment number (INH000012345) fits its narrow column on one line at 7.5 pt
    cell = ParagraphStyle("cell", fontName=regular, fontSize=7.5, leading=9.5, alignment=1)
    text = ParagraphStyle("text", fontName=bold, fontSize=11, leading=14)

    def para(value, style):
        return Paragraph(escape(str(value or "")).replace("\n", "<br/>"), style)

    data = [[para(h, head) for h in HEADER]]
    for n, row in enumerate(doc.get("rows") or [], start=1):
        data.append([para(n, cell)] + [para(row.get(k), cell) for k in COLUMN_KEYS])
    widths = [usable * w / sum(TEMPLATE_WIDTHS) for w in TEMPLATE_WIDTHS]
    # Blank rows keep the format's row height (572 twips, about 10 mm); filled rows grow with their text
    heights = [None] + [None if _filled(r) else 10 * mm for r in doc.get("rows") or []]
    table = Table(data, colWidths=widths, repeatRows=1, rowHeights=heights)
    table.setStyle(TableStyle(report_style.table_commands(1) + [
        ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))

    story = [report_style.banner(TITLE, usable, bold, regular, [doc.get("label", "")]),
             Spacer(1, 8), table, Spacer(1, 18), Paragraph("With Regards", text), Spacer(1, 14),
             Paragraph("________________", text)]
    for value in (doc.get("signatoryName"), doc.get("signatoryDesignation")):
        if value:
            story.append(para(value, text))
    cc = [line.strip() for line in str(doc.get("cc") or "").split("\n") if line.strip()]
    if cc:
        story += [Spacer(1, 14), para("\n".join(["c.c.:   " + cc[0]] + cc[1:]), text)]

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin,
                      title=f"{TITLE} - {doc.get('label', '')}").build(story)
    return buf.getvalue()
