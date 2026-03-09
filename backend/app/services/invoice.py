"""Invoice PDF generation for Red Door Club tabs."""

import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

# Brand colors
OBSIDIAN = colors.HexColor("#141426")
GOLD = colors.HexColor("#C9A96E")
LIGHT_GOLD = colors.HexColor("#F5ECD7")
LIGHT_GRAY = colors.HexColor("#F8F8F8")


def generate_tab_invoice_pdf(tab: object, member: object) -> bytes:
    """Generate a branded PDF invoice for a closed tab.

    Args:
        tab: Tab ORM object with id, total_amount, opened_at, closed_at, items
        member: User ORM object with full_name, email, tier

    Returns:
        Raw PDF bytes ready to stream in a FastAPI Response.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    gold_title = ParagraphStyle(
        "GoldTitle",
        parent=styles["Title"],
        textColor=GOLD,
        fontSize=22,
        spaceAfter=4,
        fontName="Helvetica-Bold",
    )
    sub_style = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        textColor=colors.grey,
        fontSize=9,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        textColor=colors.grey,
        fontSize=8,
        spaceBefore=8,
    )
    value_style = ParagraphStyle(
        "Value",
        parent=styles["Normal"],
        fontSize=10,
    )

    elements = []

    # Header
    elements.append(Paragraph("THE RED DOOR", gold_title))
    elements.append(Paragraph("Private Members Club", sub_style))
    elements.append(Spacer(1, 0.5 * cm))

    # Divider line via table
    elements.append(Table(
        [[""]],
        colWidths=[doc.width],
        style=TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 1, GOLD),
            ("TOPPADDING", (0, 0), (-1, 0), 0),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ]),
    ))
    elements.append(Spacer(1, 0.5 * cm))

    # Invoice meta
    tab_id_short = str(getattr(tab, "id", "N/A"))[:8].upper()
    member_name = getattr(member, "full_name", None) or "Member"
    member_email = getattr(member, "email", "")
    member_tier = (getattr(member, "tier", None) or "").capitalize()

    opened_at = getattr(tab, "opened_at", None)
    closed_at = getattr(tab, "closed_at", None)

    def fmt_dt(dt: object) -> str:
        if dt is None:
            return "—"
        try:
            return dt.strftime("%d %b %Y, %H:%M")  # type: ignore[union-attr]
        except Exception:
            return str(dt)

    meta_data = [
        ["Invoice #", tab_id_short, "Member", member_name],
        ["Opened", fmt_dt(opened_at), "Email", member_email],
        ["Closed", fmt_dt(closed_at), "Tier", member_tier],
    ]
    meta_table = Table(meta_data, colWidths=[3 * cm, 6 * cm, 3 * cm, 5.5 * cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.grey),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_GRAY, colors.white]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 0.6 * cm))

    # Items table
    items = getattr(tab, "items", []) or []
    table_data = [["#", "Description", "Amount (฿)"]]
    for i, item in enumerate(items, 1):
        desc = getattr(item, "description", "Item")
        amount = getattr(item, "amount", Decimal("0.00"))
        table_data.append([str(i), desc, f"฿{amount:,.2f}"])

    # Total row
    total = getattr(tab, "total_amount", Decimal("0.00"))
    table_data.append(["", "TOTAL", f"฿{total:,.2f}"])

    items_table = Table(table_data, colWidths=[1 * cm, 13.5 * cm, 3 * cm])
    n_rows = len(table_data)
    items_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), OBSIDIAN),
        ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        # Data rows
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, n_rows - 2), [colors.white, LIGHT_GRAY]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
        # Total row
        ("FONTNAME", (0, n_rows - 1), (-1, n_rows - 1), "Helvetica-Bold"),
        ("BACKGROUND", (0, n_rows - 1), (-1, n_rows - 1), LIGHT_GOLD),
        ("TEXTCOLOR", (0, n_rows - 1), (-1, n_rows - 1), OBSIDIAN),
        ("LINEABOVE", (0, n_rows - 1), (-1, n_rows - 1), 1, GOLD),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E0E0E0")),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 1 * cm))

    # Footer
    elements.append(Paragraph(
        "Thank you for your patronage. All amounts in Thai Baht (฿).",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
    ))

    doc.build(elements)
    return buffer.getvalue()
