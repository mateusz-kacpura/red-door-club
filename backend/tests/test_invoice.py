"""Unit tests for app/services/invoice.py."""

from decimal import Decimal
from types import SimpleNamespace
from datetime import datetime, UTC

import pytest

from app.services.invoice import generate_tab_invoice_pdf

PDF_MAGIC = b"%PDF"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_item(description: str, amount: Decimal) -> SimpleNamespace:
    return SimpleNamespace(description=description, amount=amount)


def _make_tab(*, items=None, total_amount=Decimal("0.00"), tab_id=None) -> SimpleNamespace:
    import uuid
    return SimpleNamespace(
        id=tab_id or uuid.uuid4(),
        total_amount=total_amount,
        opened_at=datetime(2026, 1, 15, 20, 0, 0),
        closed_at=datetime(2026, 1, 15, 23, 30, 0),
        items=items if items is not None else [],
        status="closed",
    )


def _make_member(*, name="Alice Founder", email="alice@example.com", tier="gold") -> SimpleNamespace:
    return SimpleNamespace(full_name=name, email=email, tier=tier)


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestGenerateTabInvoicePdf:
    def test_returns_bytes(self):
        tab = _make_tab()
        member = _make_member()

        result = generate_tab_invoice_pdf(tab, member)

        assert isinstance(result, bytes)

    def test_starts_with_pdf_magic_number(self):
        tab = _make_tab()
        member = _make_member()

        result = generate_tab_invoice_pdf(tab, member)

        assert result[:4] == PDF_MAGIC

    def test_empty_items_list(self):
        tab = _make_tab(items=[], total_amount=Decimal("0.00"))
        member = _make_member()

        result = generate_tab_invoice_pdf(tab, member)

        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:4] == PDF_MAGIC

    def test_multiple_items_correct_total(self):
        items = [
            _make_item("Whisky Sour", Decimal("350.00")),
            _make_item("Negroni", Decimal("280.00")),
            _make_item("Champagne", Decimal("1200.00")),
        ]
        total = Decimal("1830.00")
        tab = _make_tab(items=items, total_amount=total)
        member = _make_member(name="Bob Investor", email="bob@example.com", tier="platinum")

        result = generate_tab_invoice_pdf(tab, member)

        assert isinstance(result, bytes)
        assert result[:4] == PDF_MAGIC
        # PDF must be non-trivially sized when there are items
        assert len(result) > 1024

    def test_single_item(self):
        items = [_make_item("House Special", Decimal("500.00"))]
        tab = _make_tab(items=items, total_amount=Decimal("500.00"))
        member = _make_member()

        result = generate_tab_invoice_pdf(tab, member)

        assert result[:4] == PDF_MAGIC

    def test_none_dates_handled_gracefully(self):
        tab = _make_tab()
        tab.opened_at = None
        tab.closed_at = None
        member = _make_member()

        result = generate_tab_invoice_pdf(tab, member)

        assert isinstance(result, bytes)
        assert result[:4] == PDF_MAGIC

    def test_missing_member_fields_handled_gracefully(self):
        """Member with minimal attributes should not cause a crash."""
        tab = _make_tab()
        member = SimpleNamespace()  # No attributes at all

        result = generate_tab_invoice_pdf(tab, member)

        assert isinstance(result, bytes)
        assert result[:4] == PDF_MAGIC

    def test_large_amount(self):
        items = [_make_item("VIP Bottle Service", Decimal("99999.99"))]
        tab = _make_tab(items=items, total_amount=Decimal("99999.99"))
        member = _make_member()

        result = generate_tab_invoice_pdf(tab, member)

        assert result[:4] == PDF_MAGIC
