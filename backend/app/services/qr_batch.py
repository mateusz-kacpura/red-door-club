"""QR Batch service — generation, PDF export, and conversion tracking."""

import io
import uuid
from datetime import datetime, timezone

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.qr_batch import QrBatch, QrCode

# Brand colors
OBSIDIAN = colors.HexColor("#141426")
GOLD = colors.HexColor("#C9A96E")
LIGHT_GOLD = colors.HexColor("#F5ECD7")


def _make_qr_image(url: str, size: float = 3.5 * cm):
    """Return a ReportLab Drawing containing a QR code."""
    qr = QrCodeWidget(url)
    bounds = qr.getBounds()
    w = bounds[2] - bounds[0]
    h = bounds[3] - bounds[1]
    d = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    d.add(qr)
    return d


async def create_batch(
    db: AsyncSession,
    *,
    promoter_id: uuid.UUID | None,
    promo_code: str | None,
    tier: str,
    count: int,
    prefix: str,
    notes: str | None,
    created_by: uuid.UUID,
) -> QrBatch:
    """Create a QR batch with N unique QR codes."""
    # Determine starting serial (global counter across all batches)
    result = await db.execute(
        select(func.count()).select_from(QrCode)
    )
    existing_count = result.scalar() or 0
    start_serial = existing_count + 1

    batch = QrBatch(
        id=uuid.uuid4(),
        promoter_id=promoter_id,
        promo_code=promo_code,
        tier=tier,
        count=count,
        prefix=prefix,
        notes=notes,
        created_by=created_by,
    )
    db.add(batch)
    await db.flush()  # get batch.id

    codes = []
    for i in range(count):
        serial = start_serial + i
        pass_id = f"{prefix}{serial:06d}"
        codes.append(QrCode(
            id=uuid.uuid4(),
            batch_id=batch.id,
            pass_id=pass_id,
        ))
    db.add_all(codes)
    await db.commit()
    await db.refresh(batch)
    return batch


async def list_batches(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[QrBatch]:
    """List QR batches ordered by newest first."""
    result = await db.execute(
        select(QrBatch).order_by(QrBatch.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def get_batch_with_codes(db: AsyncSession, batch_id: uuid.UUID) -> tuple[QrBatch, list[QrCode]] | None:
    """Get batch and its codes."""
    result = await db.execute(select(QrBatch).where(QrBatch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        return None
    codes_result = await db.execute(
        select(QrCode).where(QrCode.batch_id == batch_id).order_by(QrCode.created_at)
    )
    codes = list(codes_result.scalars().all())
    return batch, codes


def generate_pdf(batch: QrBatch, codes: list[QrCode], frontend_url: str) -> bytes:
    """Generate a branded A4 PDF with a grid of QR codes (3 per row)."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=2 * cm,
        bottomMargin=1.5 * cm,
    )

    title_style = ParagraphStyle(
        "title",
        fontName="Helvetica-Bold",
        fontSize=16,
        textColor=OBSIDIAN,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "subtitle",
        fontName="Helvetica",
        fontSize=9,
        textColor=colors.HexColor("#666666"),
        spaceAfter=2,
    )
    pass_style = ParagraphStyle(
        "pass",
        fontName="Helvetica-Bold",
        fontSize=7,
        textColor=OBSIDIAN,
        alignment=1,  # center
    )
    url_style = ParagraphStyle(
        "url",
        fontName="Helvetica",
        fontSize=5,
        textColor=colors.HexColor("#888888"),
        alignment=1,
        wordWrap="CJK",
    )

    story = []

    # Header
    story.append(Paragraph("THE RED DOOR", title_style))
    promo_info = f"Promo: {batch.promo_code or '—'}  |  Tier: {batch.tier.upper()}  |  Batch: {str(batch.id)[:8]}"
    story.append(Paragraph(promo_info, subtitle_style))
    story.append(Spacer(1, 0.5 * cm))

    # Build 3-column grid
    COLS = 3
    CELL_W = 5.5 * cm
    CELL_H = 5.5 * cm

    rows = []
    row: list = []
    for code in codes:
        url = f"{frontend_url}/qr-register?pass={code.pass_id}"
        if batch.promo_code:
            url += f"&promo={batch.promo_code}"
        url += f"&tier={batch.tier}"

        qr_drawing = _make_qr_image(url, size=3.2 * cm)

        cell_content = [
            [qr_drawing],
            [Paragraph(code.pass_id, pass_style)],
            [Paragraph(url, url_style)],
        ]
        cell_table = Table(cell_content, colWidths=[CELL_W - 0.4 * cm])
        cell_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        row.append(cell_table)

        if len(row) == COLS:
            rows.append(row)
            row = []

    # Fill last row if incomplete
    while 0 < len(row) < COLS:
        row.append("")
    if row:
        rows.append(row)

    if rows:
        grid = Table(rows, colWidths=[CELL_W] * COLS, rowHeights=[CELL_H] * len(rows))
        grid.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ]))
        story.append(grid)

    doc.build(story)
    return buffer.getvalue()


async def mark_converted(db: AsyncSession, pass_id: str, user_id: uuid.UUID) -> bool:
    """Mark a QR code as converted after successful registration."""
    result = await db.execute(select(QrCode).where(QrCode.pass_id == pass_id))
    code = result.scalar_one_or_none()
    if not code or code.converted_at is not None:
        return False
    code.converted_at = datetime.now(timezone.utc)
    code.registered_user_id = user_id
    await db.commit()
    return True
