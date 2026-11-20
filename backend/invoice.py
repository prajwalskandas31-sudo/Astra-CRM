"""Client tax invoices (PDF), in the layout of the company's Zoho invoices (#INVOICE BLR1126253).

Used by the Invoice Block (any e-signed client, generated on demand) and by Old Client renewals (emailed
once the Client_information_page_updates group approves). The seller block comes from the Company
Profile, the client and amounts from the Client Information Page, the rates, Notes and Terms from the
Invoice Controls.

Numbers: <Branch ID><MM><YY><running number of that branch in that month>, e.g. BLR1126253 is the
253rd invoice of branch BLR in November 2026. The branch is the one of the employee who submitted the
Client Information Page. Every number ever issued is recorded, so none is used twice.

GST: the Rate is the Net Sale (taxable value). Client in the company's own State: CGST + SGST; any other
State (or no State on file): IGST. Total = Net Sale + tax.
Invoice 1 / Invoice 2: when the client paid (gross, incl. GST) less than the service's Value (Rs) in the
Service Master, Invoice 2 is recommended: the same invoice plus the Service Value and the Balance Due.
"""
import base64
import calendar
import io
import os
import re
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

try:
    from backend import store
except ImportError:
    import store


IST = timezone(timedelta(hours=5, minutes=30))
COUNTERS = "invoiceCounters"   # kv: {"BLR-1126": last running number used}
NUMBERS = "invoiceNumbers"     # every number issued: {id: number, branchCode, issuedAt, source}
SETTINGS = "invoiceSettings"   # kv: the Invoice Controls
FALLBACK_BRANCH = "HO"         # when the submitter's branch has no Branch ID and Invoice Controls name none
HSN_SAC = "998311"
TYPE_OF_SERVICE = "Research"
BRANCH_RE = re.compile(r"^[A-Z0-9][A-Z0-9_-]{0,19}$")

DEFAULT_NOTES = ("* This is a system generated Invoice.\n"
                 "* All payments made towards RA services are Non - Refundable.")
DEFAULT_TERMS = ("* Investments in Securities market are subject to Market Risks. Read all related documents carefully "
                 "before Investing.\n"
                 "* Registration granted by SEBI, and certification from NISM in no way guarantee performance of the "
                 "Intermediary or provide any assurance of returns to Investors.\n"
                 "* Never trade without Stop Loss.")
DEFAULT_SETTINGS = {"gstPercent": 18, "igstPercent": 18, "cgstPercent": 9, "sgstPercent": 9,
                    "notes": DEFAULT_NOTES, "terms": DEFAULT_TERMS, "defaultBranchCode": ""}

# GST State codes, printed with the Place of Supply ("Telangana (36)")
STATE_CODES = {
    "Jammu and Kashmir": "01", "Himachal Pradesh": "02", "Punjab": "03", "Chandigarh": "04", "Uttarakhand": "05",
    "Haryana": "06", "Delhi (NCT)": "07", "Rajasthan": "08", "Uttar Pradesh": "09", "Bihar": "10", "Sikkim": "11",
    "Arunachal Pradesh": "12", "Nagaland": "13", "Manipur": "14", "Mizoram": "15", "Tripura": "16", "Meghalaya": "17",
    "Assam": "18", "West Bengal": "19", "Jharkhand": "20", "Odisha": "21", "Chhattisgarh": "22", "Madhya Pradesh": "23",
    "Gujarat": "24", "Dadra and Nagar Haveli and Daman and Diu": "26", "Maharashtra": "27", "Karnataka": "29",
    "Goa": "30", "Lakshadweep": "31", "Kerala": "32", "Tamil Nadu": "33", "Puducherry": "34",
    "Andaman and Nicobar Islands": "35", "Telangana": "36", "Andhra Pradesh": "37", "Ladakh": "38",
}


# ==========================================
# Invoice Controls
# ==========================================
def settings() -> dict:
    saved = store.get_value(SETTINGS, {}) or {}
    return {**DEFAULT_SETTINGS, **{k: v for k, v in saved.items() if k in DEFAULT_SETTINGS}}


# ==========================================
# Numbers
# ==========================================
def branch_code_for(user_id: Optional[str]) -> tuple:
    """(Branch ID, where it came from): the submitter's branch, else the Invoice Controls default, else HO."""
    user = store.get("users", user_id) if user_id else None
    branch = store.get("branches", user.get("branchId")) if user and user.get("branchId") else None
    code = str((branch or {}).get("branchCode") or "").strip().upper()
    if BRANCH_RE.fullmatch(code):
        return code, "branch"
    default = str(settings().get("defaultBranchCode") or "").strip().upper()
    if BRANCH_RE.fullmatch(default):
        return default, "default"
    return FALLBACK_BRANCH, "fallback"


def month_key(code: str, now: Optional[datetime] = None) -> str:
    day = (now or datetime.now(IST)).astimezone(IST)
    return f"{code}-{day.month:02d}{day.year % 100:02d}"


def format_number(code: str, now: datetime, running: int) -> str:
    day = now.astimezone(IST)
    return f"{code}{day.month:02d}{day.year % 100:02d}{running:03d}"


def next_number(branch_code: str, now: Optional[datetime] = None, source: str = "") -> str:
    """Reserve the next number of this branch for this month (skipping any already issued)."""
    now = (now or datetime.now(IST)).astimezone(IST)
    key = month_key(branch_code, now)
    with store.transaction():
        with store.update_value(COUNTERS, {}) as box:
            counters = dict(box[0] or {})
            running = int(counters.get(key) or 0) + 1
            while store.get(NUMBERS, format_number(branch_code, now, running)):
                running += 1
            counters[key] = running
            box[0] = counters
        number = format_number(branch_code, now, running)
        store.put(NUMBERS, number, {"id": number, "branchCode": branch_code, "issuedAt": now.isoformat(), "source": source})
    return number


def upcoming_number(branch_code: str, now: Optional[datetime] = None) -> int:
    """The running number the branch's next invoice this month will get."""
    now = (now or datetime.now(IST)).astimezone(IST)
    running = int((store.get_value(COUNTERS, {}) or {}).get(month_key(branch_code, now)) or 0) + 1
    while store.get(NUMBERS, format_number(branch_code, now, running)):
        running += 1
    return running


def set_upcoming_number(branch_code: str, running: int, now: Optional[datetime] = None) -> None:
    """Continue the branch's series from `running` this month (e.g. after the last Zoho invoice)."""
    now = (now or datetime.now(IST)).astimezone(IST)
    with store.update_value(COUNTERS, {}) as box:
        counters = dict(box[0] or {})
        counters[month_key(branch_code, now)] = running - 1
        box[0] = counters


# ==========================================
# Amounts
# ==========================================
def amount(value) -> float:
    try:
        return round(float(str(value).replace(",", "").replace("₹", "").strip() or 0), 2)
    except ValueError:
        return 0.0


def grouped(value: float) -> str:
    """1,50,847.46 (Indian grouping)."""
    whole, paise = f"{abs(value):.2f}".split(".")
    head, tail = whole[:-3], whole[-3:]
    if head:
        head = re.sub(r"(\d)(?=(\d{2})+$)", r"\1,", head)
        whole = f"{head},{tail}"
    return f"{'-' if value < 0 else ''}{whole}.{paise}"


def rupees(value: float) -> str:
    return f"₹{grouped(value)}"


def percent(value) -> str:
    return f"{float(value):.2f}".rstrip("0").rstrip(".")


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
         "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _below_hundred(n: int) -> str:
    return _ONES[n] if n < 20 else "-".join(w for w in (_TENS[n // 10], _ONES[n % 10]) if w)


def _words(n: int) -> str:
    if n == 0:
        return "Zero"
    parts = []
    for size, name in ((10_000_000, "Crore"), (100_000, "Lakh"), (1000, "Thousand"), (100, "Hundred")):
        if n >= size:
            count = n // size
            parts.append(f"{_words(count) if size == 10_000_000 else _below_hundred(count)} {name}")
            n %= size
    if n:
        parts.append(_below_hundred(n))
    return " ".join(parts)


def in_words(value: float) -> str:
    """Indian Rupee Twenty-Five Thousand Only (as on the Zoho invoices)."""
    rupee, paise = divmod(round(abs(value) * 100), 100)
    text = f"Indian Rupee {_words(int(rupee))}"
    if paise:
        text += f" and {_below_hundred(int(paise))} Paise"
    return text + " Only"


def service_value(name: str) -> Optional[float]:
    """Value (Rs) of the service in the Service Master (matched by name), or None."""
    wanted = " ".join(str(name or "").split()).lower()
    for s in store.all("services") if wanted else []:
        if " ".join(str(s.get("name") or "").split()).lower() == wanted and str(s.get("value") or "").strip() != "":
            value = amount(s.get("value"))
            return value if value > 0 else None
    return None


def _same_state(a, b) -> bool:
    return bool(a and b and str(a).strip().lower() == str(b).strip().lower())


def figures(details: dict, company_state: str = "", value: Optional[float] = None, cfg: Optional[dict] = None) -> dict:
    """Every amount the invoice prints, and which invoice is recommended."""
    cfg = cfg or settings()
    d = details or {}
    gross = amount(d.get("grossSales"))
    net = amount(d.get("netSales"))
    if not net and gross:
        net = round(gross / (1 + float(cfg["gstPercent"]) / 100), 2)
    intra = _same_state(company_state, d.get("clientState"))
    if intra:
        taxes = [("CGST", float(cfg["cgstPercent"])), ("SGST", float(cfg["sgstPercent"]))]
    else:
        taxes = [("IGST", float(cfg["igstPercent"]))]
    taxes = [{"name": n, "percent": p, "amount": round(net * p / 100, 2)} for n, p in taxes]
    total = round(net + sum(t["amount"] for t in taxes), 2)
    paid = gross or total
    balance = round(value - paid, 2) if value else 0.0
    return {"net": net, "gross": gross, "paid": paid, "taxes": taxes, "total": total, "intraState": intra,
            "serviceValue": value, "balance": max(balance, 0.0), "recommended": 2 if balance > 0 else 1}


# ==========================================
# Dates
# ==========================================
def _add_months(day: date, months: int) -> date:
    month = day.month - 1 + months
    year, month = day.year + month // 12, month % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def due_date(issued: date, tenure) -> Optional[date]:
    """Invoice date + service tenure - 1 day (13/11 + 1 Month -> 12/12); None when the tenure is unknown."""
    text = str(tenure or "").strip().lower()
    if text == "demo":
        return issued + timedelta(days=6)
    match = re.fullmatch(r"(\d{1,3})\s*(day|days|week|weeks|month|months|year|years)", text)
    if not match:
        return None
    n, unit = int(match.group(1)), match.group(2)
    if unit.startswith("day"):
        end = issued + timedelta(days=n)
    elif unit.startswith("week"):
        end = issued + timedelta(weeks=n)
    else:
        end = _add_months(issued, n * (12 if unit.startswith("year") else 1))
    return end - timedelta(days=1)


# ==========================================
# PDF
# ==========================================
FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
NAVY, BLUE, LIGHT = colors.HexColor("#1b1f5e"), colors.HexColor("#3480b8"), colors.HexColor("#f2f7fa")
GREY, INK = colors.HexColor("#555555"), colors.HexColor("#222222")
MARGIN = 15 * mm
FRAME_WIDTH = A4[0] - 2 * MARGIN - 12  # the frame keeps 6 pt of padding each side


def _cols(*parts) -> list:
    """Column widths in proportion to `parts`, filling the frame exactly."""
    return [FRAME_WIDTH * p / sum(parts) for p in parts]


def _fonts() -> tuple:
    """(regular, bold, bold italic): Noto Sans (has the Rs sign); Helvetica if the files are missing."""
    if "NotoSans" in pdfmetrics.getRegisteredFontNames():
        return "NotoSans", "NotoSans-Bold", "NotoSans-BoldItalic"
    try:
        for name, file in (("NotoSans", "NotoSans-Regular.ttf"), ("NotoSans-Bold", "NotoSans-Bold.ttf"),
                           ("NotoSans-BoldItalic", "NotoSans-BoldItalic.ttf")):
            pdfmetrics.registerFont(TTFont(name, os.path.join(FONT_DIR, file)))
        return "NotoSans", "NotoSans-Bold", "NotoSans-BoldItalic"
    except Exception:  # noqa: BLE001 - an invoice without the nicer font beats no invoice
        return "Helvetica", "Helvetica-Bold", "Helvetica-BoldOblique"


def _company() -> dict:
    keys = ("companyName", "natureOfBusiness", "companyLogo", "registeredAddress", "state", "contact", "email",
            "website", "sebiRegistrationNumber", "gstin")
    return {k: str((store.get("companyProfile", k) or {}).get("value") or "").strip() for k in keys}


def _logo(data_url: str, max_w: float = 62 * mm, max_h: float = 20 * mm):
    """The Company Logo as a flowable (PNG/JPEG/WebP/...; SVG cannot be drawn), or None."""
    match = re.match(r"^data:image/([a-z0-9.+-]+);base64,(.+)$", data_url or "", re.S)
    if not match or match.group(1) == "svg+xml":
        return None
    try:
        from PIL import Image as PILImage
        picture = PILImage.open(io.BytesIO(base64.b64decode(match.group(2))))
        picture.load()
        if picture.mode not in ("RGB", "RGBA"):
            picture = picture.convert("RGBA")
        png = io.BytesIO()
        picture.save(png, format="PNG")
        png.seek(0)
        w, h = picture.size
        scale = min(max_w / w, max_h / h)
        logo = Image(png, width=w * scale, height=h * scale)
        logo.hAlign = "LEFT"
        return logo
    except Exception:  # noqa: BLE001 - a broken logo must not stop the invoice
        return None


def _para(text: str, style) -> Paragraph:
    return Paragraph(escape(str(text or "")).replace("\n", "<br/>"), style)


def is_non_individual(d: dict) -> bool:
    """Client Category 'Non-Individual' (Corporate / Firm), tolerant of case, spacing and the dropdown label."""
    cat = re.sub(r"[\s_-]+", "", str((d or {}).get("clientCategory") or "")).lower()
    return cat.startswith("nonindividual")


def bill_to(d: dict) -> tuple:
    """(name, GSTIN or ''): a Non-Individual client is invoiced in the Firm / Company Name from the Client
    Information Page, with its GSTIN; anyone else in the client's own name."""
    d = d or {}
    if is_non_individual(d):
        name = str(d.get("firmName") or "").strip() or str(d.get("clientName") or "").strip()
        return name, str(d.get("gstin") or "").strip().upper()
    return str(d.get("clientName") or "").strip(), ""


def build_pdf(details: dict, number: str, issued: datetime, kind: Optional[int] = None,
              value: Optional[float] = None, cfg: Optional[dict] = None) -> bytes:
    """The tax invoice for one Client Information Page submission. kind 1 / 2 (None: the recommended one).
    `value` is the service's Value (Rs); None looks it up in the Service Master."""
    cfg = cfg or settings()
    company = _company()
    d = details or {}
    if value is None:
        value = service_value(d.get("serviceName"))
    f = figures(d, company["state"], value, cfg)
    kind = kind if kind in (1, 2) else f["recommended"]
    regular, bold_font, bold_italic = _fonts()
    issued_day = issued.astimezone(IST).date()
    due = due_date(issued_day, d.get("serviceTenure"))

    base = ParagraphStyle("base", fontName=regular, fontSize=8.5, leading=11.5, textColor=INK)
    grey = ParagraphStyle("grey", parent=base, textColor=GREY)
    bold = ParagraphStyle("bold", parent=base, fontName=bold_font)
    right = ParagraphStyle("right", parent=base, alignment=TA_RIGHT)
    right_bold = ParagraphStyle("rightBold", parent=bold, alignment=TA_RIGHT)
    meta_label = ParagraphStyle("metaLabel", parent=base, fontSize=9.5, leading=13, alignment=TA_RIGHT, textColor=colors.HexColor("#333333"))
    meta_value = ParagraphStyle("metaValue", parent=base, alignment=TA_RIGHT, leading=13)
    head_white = ParagraphStyle("headWhite", parent=base, textColor=colors.white)
    head_white_r = ParagraphStyle("headWhiteR", parent=head_white, alignment=TA_RIGHT)
    small_r = ParagraphStyle("smallR", parent=right, fontSize=7.5, leading=9, textColor=GREY)

    # Seller (left) and title (right)
    seller = []
    logo = _logo(company["companyLogo"])
    if logo:
        seller += [logo, Spacer(1, 1.5 * mm)]
    seller.append(_para(company["companyName"] or "Company", ParagraphStyle("co", parent=bold, fontSize=12.5, leading=16)))
    lines = [company["natureOfBusiness"], company["registeredAddress"]]
    if company["state"] and company["state"].lower() not in company["registeredAddress"].lower():
        lines.append(company["state"])
    lines += [f"GSTIN {company['gstin']}" if company["gstin"] else "", company["email"], company["website"]]
    seller += [_para(line, base) for line in lines if line]
    title = [_para("TAX INVOICE", ParagraphStyle("title", parent=base, fontSize=27, leading=32, alignment=TA_RIGHT, textColor=NAVY)),
             _para(f"#INVOICE {number}", right_bold)]
    header = Table([[seller, title]], colWidths=_cols(110, 70))
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    # Bill To (left) and invoice details (right)
    name, client_gstin = bill_to(d)
    bill = [_para("Bill To", ParagraphStyle("billLabel", parent=base, fontSize=9.5, leading=13)),
            _para(name or "-", ParagraphStyle("billName", parent=bold, fontSize=11.5, leading=15))]
    if client_gstin:
        bill.append(_para(f"GSTIN {client_gstin}", base))
    meta_rows = [("Invoice Date :", issued_day.strftime("%d/%m/%Y")),
                 ("Due Date :", due.strftime("%d/%m/%Y") if due else "-"),
                 ("Type of Service :", TYPE_OF_SERVICE),
                 ("SEBI Reg Number :", company["sebiRegistrationNumber"] or "-")]
    meta = Table([[_para(a, meta_label), _para(b, meta_value)] for a, b in meta_rows], colWidths=[48 * mm, 34 * mm])
    meta.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    parties = Table([[bill, meta]], colWidths=_cols(98, 82))
    parties.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                 ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    state = str(d.get("clientState") or "").strip()
    supply = f"{state} ({STATE_CODES[state]})" if state in STATE_CODES else (state or "-")

    # Item table
    taxes = f["taxes"]
    widths = [88, 22, 24, 22, 24] if len(taxes) == 1 else [72, 20, 23, 21, 21, 23]
    head = [_para("Item", head_white), _para("HSN/SAC", head_white_r), _para("Rate", head_white_r)]
    head += [_para(t["name"], head_white_r) for t in taxes] + [_para("Amount", head_white_r)]
    row = [_para(d.get("serviceName") or "Research Services", base), _para(HSN_SAC, right), _para(grouped(f["net"]), right)]
    row += [[_para(grouped(t["amount"]), right), _para(f"{percent(t['percent'])}%", small_r)] for t in taxes]
    row += [_para(grouped(f["net"]), right)]
    items = Table([head, row], colWidths=_cols(*widths))
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("LINEBELOW", (0, 1), (-1, 1), 0.8, colors.HexColor("#9a9a9a")),
        ("VALIGN", (0, 0), (-1, 0), "MIDDLE"), ("VALIGN", (0, 1), (-1, 1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, 0), 6), ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 1), (-1, 1), 7), ("BOTTOMPADDING", (0, 1), (-1, 1), 9),
        ("LEFTPADDING", (0, 0), (0, -1), 3 * mm),
    ]))

    # Totals
    tot_label = ParagraphStyle("totLabel", parent=right, fontSize=9, leading=12)
    total_rows = [["", _para("Sub Total", tot_label), _para(grouped(f["net"]), right)]]
    total_rows += [["", _para(f"{t['name']}{percent(t['percent'])} ({percent(t['percent'])}%)", tot_label),
                    _para(grouped(t["amount"]), right)] for t in taxes]
    total_rows.append(["", _para("Total", ParagraphStyle("totB", parent=right_bold, fontSize=9.5)),
                       _para(rupees(f["total"]), ParagraphStyle("totV", parent=right_bold, fontSize=9.5))])
    total_index = len(total_rows) - 1
    if kind == 2:
        total_rows.append(["", _para("Service Value", tot_label), _para(rupees(f["serviceValue"] or 0), right)])
        total_rows.append(["", _para("Balance Due", ParagraphStyle("balL", parent=right_bold, fontSize=9.5)),
                           _para(rupees(f["balance"]), ParagraphStyle("balV", parent=right_bold, fontSize=9.5))])
    totals = Table(total_rows, colWidths=_cols(100, 52, 28))
    totals.setStyle(TableStyle([
        ("BACKGROUND", (1, total_index), (2, total_index), LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, total_index), (-1, total_index), 9), ("BOTTOMPADDING", (0, total_index), (-1, total_index), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    words = Table([["", _para("Total In Words:", ParagraphStyle("wl", parent=right, textColor=colors.HexColor("#333333"))),
                    _para(in_words(f["total"]), ParagraphStyle("wv", parent=base, fontName=bold_italic, fontSize=9, leading=12, alignment=TA_LEFT))]],
                  colWidths=_cols(86, 28, 66))
    words.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))

    section = ParagraphStyle("section", parent=base, fontSize=10, leading=14)
    note_style = ParagraphStyle("note", parent=base, fontSize=7.8, leading=10)
    story = [header, Spacer(1, 12 * mm), parties, Spacer(1, 5 * mm), _para(f"Place Of Supply: {supply}", base),
             Spacer(1, 6 * mm), items, Spacer(1, 1 * mm), totals, Spacer(1, 2 * mm), words]
    for heading, text in (("Notes", cfg.get("notes")), ("Terms & Conditions", cfg.get("terms"))):
        if str(text or "").strip():
            story += [Spacer(1, 9 * mm), _para(heading, section), Spacer(1, 1 * mm), _para(str(text).strip(), note_style)]

    out = io.BytesIO()
    SimpleDocTemplate(out, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=18 * mm, bottomMargin=15 * mm,
                      title=f"Invoice {number}", author=company["companyName"] or "CRM").build(story)
    return out.getvalue()
