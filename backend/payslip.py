"""Pay Slip Block (Reports): one employee's payslip for one month, on screen and as a PDF.

Every figure comes from the Salary Block (salary.monthly(), the same numbers as its table) and the employee's
details from the User Directory (Add User page). The header uses the Company Profile: Brand Name, Company
Name, Registered Address and Logo ("<Brand> by <Company>", or just the Company Name with no brand).

Earnings:   Net Sales and Commission % (for reference, not added up), Total Salary, Incentive, Expenses
Deductions: PF, Professional Tax, Insurance, plus Absent / Half Day / Deduction / Advance when not zero
Gross Earnings - Total Deductions = Total Net Payable = the Salary Block's Final Total Salary (never below 0).

Paid Days = Total Working Days (Salary Block settings; the month's calendar days when not set) - LOP Days,
LOP Days = Absent days (with leaves beyond the paid allowance) + half of the Half Days.
"""
import base64
import calendar
import io
import re
from datetime import date
from typing import Optional
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import Paragraph

try:
    from backend import store, salary, invoice
    from backend.auth import get_current_user
except ImportError:
    import store
    import salary
    import invoice
    from auth import get_current_user

router = APIRouter(prefix="/api/payslip", tags=["payslip"])

FEATURE_ID = "payslip-block"
DEFAULT_ROLES = ("Super Admin",)  # kept in step with CRM_FEATURES in CRMContext.jsx
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ==========================================
# Access
# ==========================================
def _allowed(user: dict) -> bool:
    """Same rule as hasPermission() in CRMContext.jsx: a Feature Access override first, then the role."""
    perms = (store.get("userPermissions", user["id"]) or {}).get("value")
    if isinstance(perms, dict) and isinstance(perms.get(FEATURE_ID), bool):
        return perms[FEATURE_ID]
    return user.get("role") in DEFAULT_ROLES


def require_access(current_user: dict = Depends(get_current_user)) -> dict:
    if not _allowed(current_user):
        raise HTTPException(status_code=403, detail="You do not have access to the Pay Slip Block.")
    return current_user


# ==========================================
# Helpers
# ==========================================
def rupees(n: float) -> str:
    """Indian grouping: 1234567.5 -> ₹12,34,567.50"""
    sign = "-" if n < 0 else ""
    whole, frac = f"{abs(n):.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        head = ",".join(re.findall(r"\d{1,2}", head[::-1]))[::-1]
        whole = f"{head},{tail}"
    return f"{sign}₹{whole}.{frac}"


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
         "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _below_hundred(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return _TENS[n // 10] + (f"-{_ONES[n % 10]}" if n % 10 else "")


def _below_thousand(n: int) -> str:
    parts = []
    if n >= 100:
        parts.append(f"{_ONES[n // 100]} Hundred")
    if n % 100:
        parts.append(_below_hundred(n % 100))
    return " ".join(parts)


def number_words(n: int) -> str:
    """Indian system: 1234567 -> Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven."""
    if n == 0:
        return "Zero"
    parts = []
    crore, n = divmod(n, 10_000_000)
    lakh, n = divmod(n, 100_000)
    thousand, n = divmod(n, 1000)
    if crore:
        parts.append(f"{number_words(crore)} Crore")
    if lakh:
        parts.append(f"{_below_hundred(lakh)} Lakh")
    if thousand:
        parts.append(f"{_below_hundred(thousand)} Thousand")
    if n:
        parts.append(_below_thousand(n))
    return " ".join(parts)


def amount_in_words(amount: float) -> str:
    """35789 -> 'Indian Rupee Thirty-Five Thousand Seven Hundred Eighty-Nine Only' (with Paise when any)."""
    paise_total = int(round(max(amount, 0.0) * 100))
    whole, paise = divmod(paise_total, 100)
    text = f"Indian Rupee {number_words(whole)}"
    if paise:
        text += f" and {_below_hundred(paise)} Paise"
    return f"{text} Only"


def mask_aadhaar(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    return f"XXXX XXXX {digits[-4:]}" if len(digits) >= 4 else ""


def _dmy(day: str) -> str:
    return f"{day[8:10]}/{day[5:7]}/{day[:4]}" if DATE_RE.match(day or "") else (day or "")


def _days(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else f"{n:g}"


def default_pay_date(month: str) -> str:
    """The 1st of the month after the pay period."""
    year, mon = int(month[:4]), int(month[5:7])
    return f"{year + 1}-01-01" if mon == 12 else f"{year}-{mon + 1:02d}-01"


def _company() -> dict:
    keys = ("brandName", "companyName", "registeredAddress", "companyLogo")
    return {k: str((store.get("companyProfile", k) or {}).get("value") or "").strip() for k in keys}


def company_title(company: dict) -> str:
    brand, name = company.get("brandName", ""), company.get("companyName", "")
    if brand and name and brand.lower() != name.lower():
        return f"{brand} by {name}"
    return name or brand


# ==========================================
# The payslip
# ==========================================
def employees() -> list:
    branches = {b.get("id"): b.get("name", "") for b in store.all("branches")}
    rows = [{
        "userId": u["id"], "name": u.get("name", ""), "employeeId": u.get("employeeId", ""),
        "branch": branches.get(u.get("branchId"), ""), "payType": u.get("payType") or "",
        "status": u.get("status") or "Active", "role": u.get("role", ""),
    } for u in store.all("users")]
    return sorted(rows, key=lambda r: (r["name"].lower(), r["employeeId"]))


def build(user_id: str, month: str, pay_date: Optional[str] = None) -> dict:
    date_from, _ = salary.month_range(month)
    pay_date = (pay_date or "").strip() or default_pay_date(month)
    if not DATE_RE.match(pay_date):
        raise HTTPException(status_code=400, detail="Pay Date must be a date (YYYY-MM-DD).")
    try:
        date.fromisoformat(pay_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Pay Date must be a valid date.")
    user = store.get("users", user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found.")
    pay_type = user.get("payType") or ""
    if pay_type not in salary.PAY_TYPES:
        raise HTTPException(status_code=400, detail=f"{user.get('name') or 'This employee'} has no Pay Type. "
                                                    "Set it on the Add User page to generate a payslip.")
    row = next((r for r in salary.monthly(pay_type, month)["rows"] if r["userId"] == user_id), None)
    if row is None:  # cannot happen: monthly() lists every user with this pay type
        raise HTTPException(status_code=404, detail="Employee not found in the Salary Block.")
    c, att = row["calc"], row["attendance"]

    year, mon = int(month[:4]), int(month[5:7])
    working = att["workingDays"] or calendar.monthrange(year, mon)[1]
    lop = att["absentCharged"] + att["halfDay"] * 0.5
    paid = max(working - lop, 0)

    earnings = [{"label": "Net Sales", "amount": row.get("netSales") or 0.0, "reference": True}]
    if pay_type == salary.COMMISSION:
        pct = row.get("commissionPercent")
        earnings.append({"label": "Commission %", "text": "—" if pct is None else f"{pct:g}%", "reference": True})
    earnings += [{"label": "Total Salary", "amount": c["base"]}, {"label": "Incentive", "amount": c["incentive"]}]
    if c["expenses"]:
        earnings.append({"label": "Expenses", "amount": c["expenses"]})
    gross = salary._r2(c["base"] + c["incentive"] + c["expenses"])

    deductions = [{"label": "Provident Fund (PF)", "amount": c["pf"]},
                  {"label": "Professional Tax", "amount": c["professionalTax"]},
                  {"label": "Insurance", "amount": c["insurance"]}]
    if c["absentDeduction"]:
        deductions.append({"label": f"Absent ({_days(att['absentCharged'])} day{'s' if att['absentCharged'] != 1 else ''})",
                           "amount": c["absentDeduction"]})
    if c["halfDayDeduction"]:
        deductions.append({"label": f"Half Day ({att['halfDay']})", "amount": c["halfDayDeduction"]})
    if c["deduction"]:
        deductions.append({"label": "Deduction", "amount": c["deduction"]})
    if c["advance"]:
        deductions.append({"label": "Advance", "amount": c["advance"]})
    total_deductions = salary._r2(sum(d["amount"] for d in deductions))
    net = c["finalSalary"]  # = max(gross - total deductions, 0), same as the Salary Block

    company = _company()
    return {
        "company": {"title": company_title(company), "brandName": company["brandName"],
                    "companyName": company["companyName"], "address": company["registeredAddress"]},
        "month": month, "monthName": calendar.month_name[mon] + f" {year}", "payDate": pay_date,
        "payDateText": _dmy(pay_date), "periodFrom": date_from,
        "employee": {
            "userId": user_id, "name": user.get("name", ""), "employeeId": user.get("employeeId", ""),
            "payType": pay_type, "branch": row.get("branch", ""),
            "uanNumber": user.get("uanNumber", ""), "bankAccountNumber": user.get("bankAccountNumber", ""),
            "ifscCode": user.get("ifscCode", ""), "dateOfJoining": _dmy(user.get("dateOfJoining", "")),
            "dateOfBirth": _dmy(user.get("dateOfBirth", "")), "panNumber": user.get("panNumber", ""),
            "aadhaarMasked": mask_aadhaar(user.get("aadhaarNumber", "")),
        },
        "status": row.get("status", ""),
        "attendance": {"workingDays": working, "paidDays": _days(paid), "lopDays": _days(lop)},
        "earnings": earnings, "grossEarnings": gross,
        "deductions": deductions, "totalDeductions": total_deductions,
        "netPay": net, "amountInWords": amount_in_words(net),
    }


def summary_rows(p: dict) -> list:
    """Employee Summary as [(label, value)], in the order shown on screen and in the PDF."""
    e = p["employee"]
    return [
        ("Employee Name", e["name"]), ("Employee ID", e["employeeId"]), ("Pay Period", p["monthName"]),
        ("Pay Date", p["payDateText"]), ("UAN Number", e["uanNumber"]), ("Account Number", e["bankAccountNumber"]),
        ("IFSC Code", e["ifscCode"]), ("Date of Joining", e["dateOfJoining"]), ("Date of Birth", e["dateOfBirth"]),
        ("PAN Number", e["panNumber"]), ("Aadhaar Number", e["aadhaarMasked"]),
    ]


# ==========================================
# PDF (A4, the layout of the reference payslip)
# ==========================================
W, H = A4
LEFT, RIGHT = 40, A4[0] - 40
INK, MUTED, LINE = colors.HexColor("#222222"), colors.HexColor("#6B6B6B"), colors.HexColor("#D5D5E0")
GREEN, GREEN_BG, ROW_BG = colors.HexColor("#4CC76A"), colors.HexColor("#EAF8EE"), colors.HexColor("#F7F7F9")
TINT = colors.HexColor("#F3F2FB")


def _round_box(c, x, y, w, h, r=8, fill_parts=()):
    """A rounded box with a 1pt border; fill_parts = [(x, y, w, h, colour)] painted inside its corners."""
    if fill_parts:
        c.saveState()
        path = c.beginPath()
        path.roundRect(x, y, w, h, r)
        c.clipPath(path, stroke=0, fill=0)
        for fx, fy, fw, fh, colour in fill_parts:
            c.setFillColor(colour)
            c.rect(fx, fy, fw, fh, stroke=0, fill=1)
        c.restoreState()
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, r, stroke=1, fill=0)


def _dashed(c, x1, x2, y):
    c.saveState()
    c.setStrokeColor(colors.HexColor("#B8B8C8"))
    c.setLineWidth(0.6)
    c.setDash(2, 1.5)
    c.line(x1, y, x2, y)
    c.restoreState()


def _fit(text: str, font: str, size: float, width: float) -> str:
    text = str(text or "")
    if stringWidth(text, font, size) <= width:
        return text
    while text and stringWidth(text + "…", font, size) > width:
        text = text[:-1]
    return text + "…"


def _logo_image(data_url: str):
    """(ImageReader, width, height) of the Company Logo, or None (SVG or broken)."""
    match = re.match(r"^data:image/([a-z0-9.+-]+);base64,(.+)$", data_url or "", re.S)
    if not match or match.group(1) == "svg+xml":
        return None
    try:
        from PIL import Image as PILImage
        from reportlab.lib.utils import ImageReader
        picture = PILImage.open(io.BytesIO(base64.b64decode(match.group(2))))
        picture.load()
        if picture.mode not in ("RGB", "RGBA"):
            picture = picture.convert("RGBA")
        w, h = picture.size
        scale = min(80 / w, 30 / h)
        return ImageReader(picture), w * scale, h * scale
    except Exception:  # noqa: BLE001 - a broken logo must not stop the payslip
        return None


def render_pdf(p: dict) -> bytes:
    regular, bold, _ = invoice._fonts()
    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Payslip {p['employee']['employeeId'] or p['employee']['name']} {p['monthName']}")
    c.setAuthor(p["company"]["companyName"] or "CRM")

    # ---- Header: logo, "<Brand> by <Company>", address | Payslip For the Month
    top = H - 40
    x = LEFT
    logo = _logo_image(_company().get("companyLogo", ""))
    if logo:
        reader, lw, lh = logo
        c.drawImage(reader, LEFT, top - 8 - lh, width=lw, height=lh, mask="auto")
        x = LEFT + lw + 10
    title_style = ParagraphStyle("t", fontName=bold, fontSize=15, leading=18, textColor=INK)
    title = Paragraph(escape(p["company"]["title"] or "Company Name"), title_style)
    tw, th = title.wrap(RIGHT - 150 - x, 60)
    title.drawOn(c, x, top - th)
    y = top - th
    if p["company"]["address"]:
        addr = Paragraph(escape(p["company"]["address"]), ParagraphStyle("a", fontName=regular, fontSize=9, leading=11.5, textColor=MUTED))
        aw, ah = addr.wrap(RIGHT - 150 - x, 60)
        addr.drawOn(c, x, y - 3 - ah)
        y -= 3 + ah
    if logo:
        y = min(y, top - 8 - logo[2])
    c.setFont(regular, 9.5)
    c.setFillColor(MUTED)
    c.drawRightString(RIGHT, top - 10, "Payslip For the Month")
    c.setFont(bold, 13)
    c.setFillColor(INK)
    c.drawRightString(RIGHT, top - 27, p["monthName"])
    y = min(y, top - 32) - 12
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.line(LEFT, y, RIGHT, y)

    # ---- Employee Summary (left) and Total Net Pay card (right)
    y -= 22
    c.setFont(bold, 8.5)
    c.setFillColor(MUTED)
    c.drawString(LEFT + 10, y, "EMPLOYEE SUMMARY")
    card_x, card_w = RIGHT - 215, 215
    row_y = y - 18
    for label, value in summary_rows(p):
        c.setFont(regular, 9.5)
        c.setFillColor(MUTED)
        c.drawString(LEFT + 10, row_y, label)
        c.drawString(LEFT + 120, row_y, ":")
        c.setFillColor(INK)
        c.drawString(LEFT + 130, row_y, _fit(value or "—", regular, 9.5, card_x - LEFT - 145))
        row_y -= 17
    summary_bottom = row_y + 5

    card_top = y + 8
    card_h = 140
    green_h = 68
    _round_box(c, card_x, card_top - card_h, card_w, card_h,
               fill_parts=[(card_x, card_top - green_h, card_w, green_h, GREEN_BG)])
    c.setStrokeColor(GREEN)
    c.setLineWidth(2.5)
    c.line(card_x + 18, card_top - 16, card_x + 18, card_top - 52)
    c.setFont(regular, 19)
    c.setFillColor(INK)
    c.drawString(card_x + 28, card_top - 34, rupees(p["netPay"]))
    c.setFont(regular, 9.5)
    c.setFillColor(colors.HexColor("#5F7F68"))
    c.drawString(card_x + 28, card_top - 50, "Total Net Pay")
    _dashed(c, card_x + 18, card_x + card_w - 18, card_top - green_h - 4)
    for i, (label, value) in enumerate((("Paid Days", p["attendance"]["paidDays"]), ("LOP Days", p["attendance"]["lopDays"]))):
        ly = card_top - green_h - 26 - i * 20
        c.setFont(regular, 9.5)
        c.setFillColor(MUTED)
        c.drawString(card_x + 18, ly, label)
        c.drawString(card_x + 120, ly, ":")
        c.setFillColor(INK)
        c.drawString(card_x + 130, ly, value)

    # ---- Pay Type (the marked spot under the summary)
    y = min(summary_bottom, card_top - card_h) - 16
    _round_box(c, LEFT, y - 26, RIGHT - LEFT, 26, r=6, fill_parts=[(LEFT, y - 26, RIGHT - LEFT, 26, TINT)])
    c.setFont(regular, 9.5)
    c.setFillColor(MUTED)
    c.drawString(LEFT + 10, y - 17, "Pay Type")
    c.drawString(LEFT + 120, y - 17, ":")
    c.setFont(bold, 10)
    c.setFillColor(INK)
    c.drawString(LEFT + 130, y - 17, p["employee"]["payType"])
    y -= 26 + 16

    # ---- Earnings | Deductions
    earnings, deductions = p["earnings"], p["deductions"]
    lines = max(len(earnings), len(deductions))
    head_h, row_h = 30, 21
    box_h = head_h + 8 + lines * row_h + row_h + 6
    box_y = y - box_h
    mid = LEFT + (RIGHT - LEFT) / 2
    _round_box(c, LEFT, box_y, RIGHT - LEFT, box_h,
               fill_parts=[(LEFT, box_y, RIGHT - LEFT, row_h + 6, ROW_BG)])
    halves = ((LEFT + 14, mid - 12, "EARNINGS"), (mid + 12, RIGHT - 14, "DEDUCTIONS"))
    for x1, x2, heading in halves:
        c.setFont(bold, 9)
        c.setFillColor(colors.HexColor("#333333"))
        c.drawString(x1, y - 19, heading)
        c.drawRightString(x2, y - 19, "AMOUNT")
        _dashed(c, x1, x2, y - head_h + 2)

    def item_rows(items, x1, x2):
        for i, item in enumerate(items):
            ry = y - head_h - 8 - i * row_h - 6
            ref = item.get("reference")
            c.setFont(regular, 9)
            c.setFillColor(MUTED if ref else INK)
            c.drawString(x1, ry, _fit(item["label"], regular, 9, x2 - x1 - 90))
            c.setFont(regular if ref else bold, 9)
            c.drawRightString(x2, ry, item.get("text") or rupees(item.get("amount") or 0.0))

    item_rows(earnings, halves[0][0], halves[0][1])
    item_rows(deductions, halves[1][0], halves[1][1])
    ty = box_y + 10
    c.setFillColor(colors.HexColor("#333333"))
    c.setFont(bold, 9.5)
    c.drawString(halves[0][0], ty, "Gross Earnings")
    c.drawRightString(halves[0][1], ty, rupees(p["grossEarnings"]))
    c.drawString(halves[1][0], ty, "Total Deductions")
    c.drawRightString(halves[1][1], ty, rupees(p["totalDeductions"]))
    y = box_y - 20

    # ---- Total Net Payable
    net_h = 44
    green_w = 130
    _round_box(c, LEFT, y - net_h, RIGHT - LEFT, net_h,
               fill_parts=[(RIGHT - green_w, y - net_h, green_w, net_h, GREEN_BG)])
    c.setFont(bold, 10)
    c.setFillColor(INK)
    c.drawString(LEFT + 14, y - 18, "TOTAL NET PAYABLE")
    c.setFont(regular, 9)
    c.setFillColor(MUTED)
    c.drawString(LEFT + 14, y - 32, "Gross Earnings - Total Deductions")
    c.setFont(bold, 11)
    c.setFillColor(INK)
    c.drawCentredString(RIGHT - green_w / 2, y - 26, rupees(p["netPay"]))
    y -= net_h + 14

    # ---- Amount in words, footer
    words = Paragraph(f'<font color="#6B6B6B">Amount In Words</font> : {escape(p["amountInWords"])}',
                      ParagraphStyle("w", fontName=regular, fontSize=9.5, leading=12, textColor=INK, alignment=TA_RIGHT))
    ww, wh = words.wrap(RIGHT - LEFT, 60)
    words.drawOn(c, LEFT, y - wh)
    y -= wh + 12
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.line(LEFT, y, RIGHT, y)
    c.setFont(regular, 7.5)
    c.setFillColor(MUTED)
    c.drawCentredString(W / 2, y - 26, "-- This is a system-generated document. --")

    c.showPage()
    c.save()
    return buf.getvalue()


def file_name(p: dict) -> str:
    code = re.sub(r"[^A-Za-z0-9_-]+", "_", p["employee"]["employeeId"] or p["employee"]["name"]).strip("_") or "Employee"
    return f"Payslip_{code}_{calendar.month_abbr[int(p['month'][5:7])]}_{p['month'][:4]}.pdf"


# ==========================================
# Routes
# ==========================================
@router.get("/employees")
def list_employees(current_user: dict = Depends(require_access)):
    return {"employees": employees()}


@router.get("")
def get_payslip(userId: str = Query(...), month: str = Query(...), payDate: str = Query(""),
                current_user: dict = Depends(require_access)):
    return build(userId, month, payDate)


@router.get("/pdf")
def payslip_pdf(userId: str = Query(...), month: str = Query(...), payDate: str = Query(""),
                current_user: dict = Depends(require_access)):
    p = build(userId, month, payDate)
    return Response(render_pdf(p), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{file_name(p)}"'})
