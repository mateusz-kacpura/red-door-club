"""Unit tests for app/services/promoter.py."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import BadRequestError, NotFoundError
from app.services.promoter import PromoterService


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.scalar = AsyncMock()
    db.get = AsyncMock()
    return db


def _make_promo(code="PRO-01", is_active=True, quota=0, uses_count=0, tier_grant=None):
    p = MagicMock()
    p.id = uuid4()
    p.code = code.upper()
    p.is_active = is_active
    p.quota = quota
    p.uses_count = uses_count
    p.tier_grant = tier_grant
    p.promoter_id = uuid4()
    p.revenue_attributed = Decimal("0.00")
    p.commission_rate = Decimal("0.50")
    return p


def _make_user(tier=None):
    u = MagicMock()
    u.id = uuid4()
    u.full_name = "Bob Promoter"
    u.email = "bob@example.com"
    u.tier = tier
    u.referred_by_code = None
    u.is_promoter = True
    return u


def _exec_result(value):
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    return r


# ── validate_and_apply_code ───────────────────────────────────────────────────


class TestValidateAndApplyCode:
    @pytest.mark.anyio
    async def test_valid_code_is_applied_to_user(self):
        db = _make_db()
        promo = _make_promo(code="PRO-01")
        user = _make_user()
        db.execute.return_value = _exec_result(promo)

        with patch("app.services.promoter.PromoCodeUse") as MockUse:
            result = await PromoterService.validate_and_apply_code(db, "PRO-01", user)

        assert result is promo
        assert user.referred_by_code == "PRO-01"
        assert promo.uses_count == 1
        db.commit.assert_awaited_once()

    @pytest.mark.anyio
    async def test_code_not_found_returns_none(self):
        db = _make_db()
        user = _make_user()
        db.execute.return_value = _exec_result(None)

        result = await PromoterService.validate_and_apply_code(db, "INVALID", user)

        assert result is None
        db.commit.assert_not_awaited()

    @pytest.mark.anyio
    async def test_quota_exhausted_returns_none(self):
        db = _make_db()
        promo = _make_promo(quota=5, uses_count=5)
        user = _make_user()
        db.execute.return_value = _exec_result(promo)

        result = await PromoterService.validate_and_apply_code(db, "PRO-01", user)

        assert result is None

    @pytest.mark.anyio
    async def test_unlimited_quota_zero_always_allowed(self):
        db = _make_db()
        promo = _make_promo(quota=0, uses_count=1000)
        user = _make_user()
        db.execute.return_value = _exec_result(promo)

        with patch("app.services.promoter.PromoCodeUse"):
            result = await PromoterService.validate_and_apply_code(db, "PRO-01", user)

        assert result is promo

    @pytest.mark.anyio
    async def test_tier_grant_applied_when_user_has_no_tier(self):
        db = _make_db()
        promo = _make_promo(tier_grant="gold")
        user = _make_user(tier=None)
        db.execute.return_value = _exec_result(promo)

        with patch("app.services.promoter.PromoCodeUse"):
            await PromoterService.validate_and_apply_code(db, "PRO-01", user)

        assert user.tier == "gold"

    @pytest.mark.anyio
    async def test_tier_override_takes_precedence(self):
        db = _make_db()
        promo = _make_promo(tier_grant="silver")
        user = _make_user(tier=None)
        db.execute.return_value = _exec_result(promo)

        with patch("app.services.promoter.PromoCodeUse"):
            await PromoterService.validate_and_apply_code(
                db, "PRO-01", user, tier_override="obsidian"
            )

        assert user.tier == "obsidian"

    @pytest.mark.anyio
    async def test_existing_tier_not_overwritten(self):
        db = _make_db()
        promo = _make_promo(tier_grant="gold")
        user = _make_user(tier="obsidian")
        db.execute.return_value = _exec_result(promo)

        with patch("app.services.promoter.PromoCodeUse"):
            await PromoterService.validate_and_apply_code(db, "PRO-01", user)

        # tier should remain unchanged since user already has one
        assert user.tier == "obsidian"


# ── request_payout ────────────────────────────────────────────────────────────


class TestRequestPayout:
    @pytest.mark.anyio
    async def test_creates_payout_request(self):
        db = _make_db()
        promoter_id = uuid4()

        with patch("app.services.promoter.PayoutRequest") as MockPayout:
            payout_obj = MagicMock()
            MockPayout.return_value = payout_obj
            result = await PromoterService.request_payout(db, promoter_id, Decimal("500.00"))

        assert result is payout_obj
        db.add.assert_called_once_with(payout_obj)
        db.commit.assert_awaited_once()

    @pytest.mark.anyio
    async def test_zero_amount_raises_bad_request(self):
        db = _make_db()
        with pytest.raises(BadRequestError, match="positive"):
            await PromoterService.request_payout(db, uuid4(), Decimal("0.00"))

    @pytest.mark.anyio
    async def test_negative_amount_raises_bad_request(self):
        db = _make_db()
        with pytest.raises(BadRequestError, match="positive"):
            await PromoterService.request_payout(db, uuid4(), Decimal("-10.00"))


# ── approve_payout ────────────────────────────────────────────────────────────


class TestApprovePayout:
    @pytest.mark.anyio
    async def test_marks_payout_as_paid(self):
        db = _make_db()
        payout = MagicMock()
        payout.status = "pending"
        db.get.return_value = payout

        result = await PromoterService.approve_payout(db, uuid4(), notes="Approved by admin")

        assert result.status == "paid"
        assert result.notes == "Approved by admin"
        db.commit.assert_awaited_once()

    @pytest.mark.anyio
    async def test_payout_not_found_raises_not_found(self):
        db = _make_db()
        db.get.return_value = None

        with pytest.raises(NotFoundError):
            await PromoterService.approve_payout(db, uuid4())


# ── get_stats ─────────────────────────────────────────────────────────────────


class TestGetStats:
    @pytest.mark.anyio
    async def test_returns_stats_dict(self):
        db = _make_db()
        promo1 = _make_promo()
        promo1.uses_count = 10
        promo1.revenue_attributed = Decimal("5000.00")
        promo1.commission_rate = Decimal("0.50")

        mock_codes_result = MagicMock()
        mock_codes_result.scalars.return_value.all.return_value = [promo1]
        db.execute.return_value = mock_codes_result
        db.scalar.return_value = Decimal("100.00")

        stats = await PromoterService.get_stats(db, uuid4())

        assert stats["total_codes"] == 1
        assert stats["total_uses"] == 10
        assert stats["total_revenue"] == 5000.0
        assert stats["commission_earned"] == 2500.0

    @pytest.mark.anyio
    async def test_returns_zeros_when_no_codes(self):
        db = _make_db()
        mock_codes_result = MagicMock()
        mock_codes_result.scalars.return_value.all.return_value = []
        db.execute.return_value = mock_codes_result
        db.scalar.return_value = Decimal("0.00")

        stats = await PromoterService.get_stats(db, uuid4())

        assert stats["total_codes"] == 0
        assert stats["total_uses"] == 0
        assert stats["total_revenue"] == 0.0
        assert stats["commission_earned"] == 0.0
