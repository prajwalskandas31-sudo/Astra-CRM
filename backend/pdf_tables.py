"""A plain table report as a PDF: company name, title, one table (repeating header on every page).

Used by the Running Account Statement and the Audit Report downloads. Uses the invoice's bundled Noto
Sans so the Rs sign prints.
"""
import io
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

try:
    from backend import invoice, report_style
except ImportError:
    import invoice
    import report_style

IST = timezone(timedelta(hours=5, minutes=30))


def render(title: str, header: List[str], rows: List[list], widths: List[float], subtitle: str = "",
           numeric_from: Optional[int] = None, landscape_page: bool = False, bold_last: bool = False,
           spans: Optional[list] = None, header_rows: int = 1, notes: Optional[List[str]] = None,
           extra: Optional[List[dict]] = None) -> bytes:
    """rows: lists of str (or a list of header rows when header_rows > 1, passed first in `rows`).

    widths are proportions; numeric_from right-aligns that column and the ones after it;
    spans are extra ("SPAN", (c0, r0), (c1, r1)) commands in table coordinates (header included);
    extra: more tables after the first, each {"title", "note", "header", "rows", "widths"}.
    """
    regular, bold, _ = invoice._fonts()
    page = landscape(A4) if landscape_page else A4
    margin = 12 * mm
    usable = page[0] - 2 * margin
    cell = ParagraphStyle("cell", fontName=regular, fontSize=7.6, leading=9.4, textColor=report_style.INK)
    head = report_style.header_style(cell, bold)
    right = ParagraphStyle("right", parent=cell, alignment=2)

    def para(value, style):
        return Paragraph(escape(str(value if value is not None else "")).replace("\n", "<br/>"), style)

    def build(header, rows, widths, header_rows=1, numeric_from=None, bold_last=False, spans=None):
        data = []
        header_block = [header] if header_rows == 1 else rows[:header_rows]
        body = rows if header_rows == 1 else rows[header_rows:]
        for hr in header_block:
            data.append([para(h, head) for h in hr])
        for i, r in enumerate(body):
            style_last = bold_last and i == len(body) - 1
            out = []
            for c, v in enumerate(r):
                st = right if numeric_from is not None and c >= numeric_from else cell
                if style_last:
                    st = ParagraphStyle("b", parent=st, fontName=bold)
                out.append(para(v, st))
            data.append(out)

        table = Table(data, colWidths=[usable * w / sum(widths) for w in widths], repeatRows=len(header_block))
        commands = report_style.table_commands(len(header_block), bold_last, len(body)) + (spans or [])
        table.setStyle(TableStyle(commands))

        return table

    table = build(header, rows, widths, header_rows, numeric_from, bold_last, spans)
    company = str((invoice._company() or {}).get("companyName") or "").strip()
    note = report_style.note_style(regular)
    story = [report_style.banner(title, usable, bold, regular, [company, subtitle]), Spacer(1, 8), table]
    for t in extra or []:
        story += [Spacer(1, 14), report_style.section(t["title"], bold)]
        if t.get("note"):
            story.append(Paragraph(escape(t["note"]), note))
        story += [Spacer(1, 4), build(t["header"], t["rows"], t["widths"])]
    if notes:
        story.append(Spacer(1, 6))
    for n in notes or []:
        story += [Spacer(1, 3), Paragraph(escape(n), note)]
    stamp = datetime.now(IST).strftime("Generated on %d/%m/%Y %I:%M %p IST")
    story += [Spacer(1, 8), Paragraph(stamp, note)]

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=page, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin,
                      title=title).build(story)
    return buf.getvalue()
