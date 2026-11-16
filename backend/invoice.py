"""Client invoices (PDF).

Used for Old Client renewals: once the Client_information_page_updates group approves one, the client is
emailed only this invoice (no e-KYC, no Welcome Kit). The seller block comes from the Company Profile; the
amounts are the ones on the Client Information Page (Gross = Net + GST).

Invoice numbers run per Indian financial year (April to March): INV/2026-27/0001, INV/2026-27/0002, ...
"""
import io
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

try:
    from backend import store
except ImportError:
    import store


IST = timezone(timedelta(hours=5, minutes=30))
COUNTER = "invoiceCounter"  # {"2026-27": last number used}


# ==========================================
# Numbers
# ==========================================
def financial_year(day: datetime) -> str:
    start = day.year if day.month >= 4 else day.year - 1
    return f"{start}-{(start + 1) % 100:02d}"


def next_number(now: Optional[datetime] = None) -> str:
    fy = financial_year((now or datetime.now(IST)).astimezone(IST))
    with store.update_value(COUNTER, {}) as box:
        counters = dict(box[0] or {})
        counters[fy] = int(counters.get(fy) or 0) + 1
        box[0] = counters
    return f"INV/{fy}/{counters[fy]:04d}"


def amount(value) -> float:
    try:
        return round(float(str(value).replace(",", "").replace("₹", "").strip() or 0), 2)
    except ValueError:
        return 0.0


def rupees(value: float) -> str:
    """Rs. 1,50,847.46 (Indian grouping; the PDF's built-in fonts have no ₹ sign)."""
    whole, paise = f"{abs(value):.2f}".split(".")
    head, tail = whole[:-3], whole[-3:]
    if head:
        head = re.sub(r"(\d)(?=(\d{2})+$)", r"\1,", head)
        whole = f"{head},{tail}"
    return f"{'-' if value < 0 else ''}Rs. {whole}.{paise}"


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
         "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _below_hundred(n: int) -> str:
    return _ONES[n] if n < 20 else " ".join(w for w in (_TENS[n // 10], _ONES[n % 10]) if w)


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
    rupee, paise = divmod(round(abs(value) * 100), 100)
    text = f"Rupees {_words(int(rupee))}"
    if paise:
        text += f" and {_below_hundred(int(paise))} Paise"
    return text + " Only"


# ==========================================
# PDF
# ==========================================
def _company() -> dict:
    keys = ("companyName", "registeredAddress", "contact", "email", "website", "sebiRegistrationNumber", "gstin")
    return {k: str((store.get("companyProfile", k) or {}).get("value") or "").strip() for k in keys}


def _para(text: str, style) -> Paragraph:
    return Paragraph(escape(text or "").replace("\n", "<br/>"), style)


def build_pdf(details: dict, number: str, issued: datetime) -> bytes:
    """The invoice for one Client Information Page submission."""
    company = _company()
    d = details or {}
    gross, net, gst = amount(d.get("grossSales")), amount(d.get("netSales")), amount(d.get("gst"))
    if not net and gross:
        net, gst = gross, 0.0
    rate = f"{gst / net * 100:.2f}".rstrip("0").rstrip(".") if net else "0"

    styles = getSampleStyleSheet()
    base = ParagraphStyle("base", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=12)
    small = ParagraphStyle("small", parent=base, fontSize=8, leading=10, textColor=colors.HexColor("#555555"))
    bold = ParagraphStyle("bold", parent=base, fontName="Helvetica-Bold")
    right = ParagraphStyle("right", parent=base, alignment=TA_RIGHT)
    right_bold = ParagraphStyle("rightBold", parent=bold, alignment=TA_RIGHT)
    title = ParagraphStyle("title", parent=bold, fontSize=16, leading=20)
    heading = ParagraphStyle("heading", parent=bold, fontSize=10, leading=13, textColor=colors.HexColor("#1f3a8a"))

    seller = [_para(company["companyName"] or "Company", title)]
    if company["registeredAddress"]:
        seller.append(_para(company["registeredAddress"], base))
    contact = "  |  ".join(x for x in (company["contact"], company["email"], company["website"]) if x)
    if contact:
        seller.append(_para(contact, base))
    ids = "  |  ".join(x for x in (f"SEBI Reg. No: {company['sebiRegistrationNumber']}" if company["sebiRegistrationNumber"] else "",
                                    f"GSTIN: {company['gstin']}" if company["gstin"] else "") if x)
    if ids:
        seller.append(_para(ids, base))

    doc_title = "TAX INVOICE" if company["gstin"] else "INVOICE"
    meta = [
        [_para(doc_title, ParagraphStyle("t2", parent=title, alignment=TA_RIGHT))],
        [_para(f"Invoice No: {number}", right_bold)],
        [_para(f"Invoice Date: {issued.astimezone(IST).strftime('%d-%m-%Y')}", right)],
        [_para(f"Payment Date: {_date(d.get('paymentDate'))}", right)],
        [_para(f"Place of Supply: {d.get('clientState') or '—'}", right)],
    ]
    header = Table([[seller, Table(meta, colWidths=[70 * mm])]], colWidths=[110 * mm, 70 * mm])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    name = " ".join(x for x in (d.get("clientPrefix"), d.get("clientName")) if x)
    bill = [_para("Bill To", heading), _para(name or "—", bold)]
    if d.get("clientCategory") == "Non-Individual" and d.get("firmName"):
        bill.append(_para(d["firmName"], bold))
    for label, key in (("PAN", "panNumber"), ("GSTIN", "gstin"), ("Email", "email"), ("Phone", "phone1"), ("State", "clientState")):
        if key == "gstin" and d.get("clientCategory") != "Non-Individual":
            continue
        if d.get(key):
            bill.append(_para(f"{label}: {d[key]}", base))

    service = d.get("serviceName") or "Advisory Service"
    tenure = d.get("serviceTenure") or ""
    items = Table([
        [_para("#", bold), _para("Description", bold), _para("Tenure", bold), _para("Amount", right_bold)],
        ["1", _para(service, base), _para(tenure, base), _para(rupees(net), right)],
        ["", "", _para("Taxable Value", right), _para(rupees(net), right)],
        ["", "", _para(f"GST @ {rate}%", right), _para(rupees(gst), right)],
        ["", "", _para("Total", right_bold), _para(rupees(gross or net + gst), right_bold)],
    ], colWidths=[10 * mm, 100 * mm, 35 * mm, 35 * mm])
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.HexColor("#94a3b8")),
        ("LINEBELOW", (0, 1), (-1, 1), 0.4, colors.HexColor("#cbd5e1")),
        ("LINEABOVE", (2, 4), (-1, 4), 0.8, colors.HexColor("#334155")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#94a3b8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    txns = d.get("transactionNumbers") or []
    txns = [str(t) for t in (txns if isinstance(txns, list) else [txns]) if str(t).strip()]

    story = [header, Spacer(1, 6 * mm), *bill, Spacer(1, 6 * mm), items, Spacer(1, 3 * mm),
             _para(f"Amount in words: {in_words(gross or net + gst)}", bold)]
    if txns:
        story += [Spacer(1, 3 * mm), _para(f"Payment received. Transaction reference(s): {', '.join(txns)}", base)]
    story += [Spacer(1, 10 * mm), _para("This is a computer-generated invoice and does not require a signature.", small)]

    out = io.BytesIO()
    SimpleDocTemplate(out, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm,
                      title=f"Invoice {number}", author=company["companyName"] or "CRM").build(story)
    return out.getvalue()


def _date(value) -> str:
    """2026-11-16 -> 16-11-2026; anything else as it is."""
    text = str(value or "").strip()
    try:
        return datetime.strptime(text, "%Y-%m-%d").strftime("%d-%m-%Y")
    except ValueError:
        return text or "—"
