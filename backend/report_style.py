"""The house style of the CRM's PDF reports, matching the Excel downloads (src/lib/reportExcel.js).

A deep teal-navy title banner with a subtitle band, column headings in the same colour with white bold text and
lighter blue dividers, then white rows on a light grey grid. Totals are bold on a light teal fill.
"""
from typing import List, Optional
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle

FILL = colors.HexColor("#104869")      # title, band and header fill
DIVIDER = colors.HexColor("#3C7294")   # lines inside the header band
GRID = colors.HexColor("#D9D9D9")      # lines between the white rows
TOTAL = colors.HexColor("#E3ECF2")
LABEL = colors.HexColor("#F2F6F9")
NOTE = colors.HexColor("#595959")
INK = colors.HexColor("#1F1F1F")


def banner(title: str, width: float, bold: str, regular: str, subtitles: Optional[List[str]] = None) -> Table:
    """The title row and its band, the full width of the page."""
    head = ParagraphStyle("bannerTitle", fontName=bold, fontSize=13, leading=16, alignment=1, textColor=colors.white)
    sub = ParagraphStyle("bannerSub", fontName=regular, fontSize=8.5, leading=11, alignment=1, textColor=colors.white)
    rows = [[Paragraph(escape(title), head)]] + [[Paragraph(escape(s), sub)] for s in (subtitles or []) if s]
    if len(rows) == 1:
        rows.append([""])  # the plain band under the title, as in the sample
    t = Table(rows, colWidths=[width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FILL),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 9), ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ("TOPPADDING", (0, 1), (-1, -1), 1), ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
    ]))
    return t


def header_style(regular_parent: ParagraphStyle, bold: str, align: int = 0) -> ParagraphStyle:
    """White bold text for the heading cells."""
    return ParagraphStyle("reportHead", parent=regular_parent, fontName=bold, textColor=colors.white, alignment=align)


def table_commands(header_rows: int = 1, total_last: bool = False, body_rows: Optional[int] = None) -> list:
    """TableStyle commands: coloured heading rows, white body on a light grid, optional totals row."""
    h = max(header_rows, 0)
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, h), (-1, -1), 0.5, GRID),
        ("TEXTCOLOR", (0, h), (-1, -1), INK),
    ]
    if h:
        cmds += [
            ("BACKGROUND", (0, 0), (-1, h - 1), FILL),
            ("INNERGRID", (0, 0), (-1, h - 1), 0.5, DIVIDER),
            ("BOX", (0, 0), (-1, h - 1), 0.5, FILL),
            ("TOPPADDING", (0, 0), (-1, h - 1), 6), ("BOTTOMPADDING", (0, 0), (-1, h - 1), 6),
        ]
    if total_last and (body_rows is None or body_rows > 0):
        cmds += [("BACKGROUND", (0, -1), (-1, -1), TOTAL)]
    return cmds


def section(text: str, bold: str) -> Paragraph:
    """The heading of a second table on the same page."""
    return Paragraph(escape(text), ParagraphStyle("reportSection", fontName=bold, fontSize=10.5, leading=13, textColor=FILL,
                                                  spaceBefore=2, spaceAfter=2))


def note_style(regular: str) -> ParagraphStyle:
    return ParagraphStyle("reportNote", fontName=regular, fontSize=7.5, leading=9.5, textColor=NOTE)
