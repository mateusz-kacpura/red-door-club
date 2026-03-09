"""Unit tests for app/services/loyalty.py."""

from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import BadRequestError, NotFoundError
from app.services.loyalty import LoyaltyService


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_db():
    """Create a minimal async DB session mock."""
    db = AsyncMock()
    db.add = MagicMock()  # synchronous in SQLAlchemy
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.scalar = AsyncMock()
    db.get = AsyncMock()
    return db


def _make_user(loyalty_points: int = 500, loyalty_lifetime_points: int = 750):
    u = MagicMock()
    u.id = uuid4()
    u.loyalty_points = loyalty_points
    u.loyalty_lifetime_points = loyalty_lifetime_points
    u.full_name = "Alice Gold"
    u.company_name = "TechCo"
    u.tier = "gold"
    u.is_active = True
    return u


def _make_tx(points: int = 50, reason: str = "event_attendance"):
    tx = MagicMock()
    tx.id = uuid4()
    tx.member_id = uuid4()
    tx.points = points
    tx.reason = reason
    tx.reference_id = None
    tx.created_at = datetime.now(UTC)
    return tx


def _exec_result(scalar_value):
    """Wrap a value as a mock SQLAlchemy execute result (scalar_one_or_none)."""
    r = MagicMock()
    r.scalar_one_or_none.return_value = scalar_value
    return r


# ── award_points ──────────────────────────────────────────────────────────────


class TestAwardPoints:
    @pytest.mark.anyio
    async def test_uses_default_earn_rate_for_event_attendance(self):
        db = _make_db()
        mock_tx = _make_tx(points=50, reason="event_attendance")

        with patch("app.services.loyalty.LoyaltyTransaction", return_value=mock_tx):
            tx = await LoyaltyService.award_points(db, uuid4(), "event_attendance")

        assert tx.points == 50
        db.add.assert_called_once_with(mock_tx)
        db.commit.assert_awaited_once()

    @pytest.mark.anyio
    async def test_uses_custom_points_overriding_rate(self):
        db = _make_db()
        mock_tx = _make_tx(points=99, reason="manual_award")

        with patch("app.services.loyalty.LoyaltyTransaction", return_value=mock_tx):
            tx = await LoyaltyService.award_points(db, uuid4(), "manual_award", points=99)

        assert tx.points == 99

    @pytest.mark.anyio
    async def test_unknown_reason_without_explicit_points_raises(self):
        db = _make_db()
        with pytest.raises(ValueError, match="Unknown loyalty reason"):
            await LoyaltyService.award_points(db, uuid4(), "does_not_exist")

    @pytest.mark.anyio
    async def test_zero_explicit_points_raises_bad_request(self):
        db = _make_db()
        with pytest.raises(BadRequestError):
            await LoyaltyService.award_points(db, uuid4(), "manual_award", points=0)

    @pytest.mark.anyio
    async def test_negative_explicit_points_raises_bad_request(self):
        db = _make_db()
        with pytest.raises(BadRequestError):
            await LoyaltyService.award_points(db, uuid4(), "manual_award", points=-10)

    @pytest.mark.anyio
    async def test_earn_rates_match_expected_values(self):
        assert LoyaltyService.EARN_RATES["event_attendance"] == 50
        assert LoyaltyService.EARN_RATES["service_request"] == 20
        assert LoyaltyService.EARN_RATES["guest_referral"] == 100
        assert LoyaltyService.EARN_RATES["podcast_recording"] == 150


# ── redeem_points ─────────────────────────────────────────────────────────────


class TestRedeemPoints:
    @pytest.mark.anyio
    async def test_redeem_success_with_sufficient_balance(self):
        db = _make_db()
        user = _make_user(loyalty_points=500)
        db.execute.return_value = _exec_result(user)
        mock_tx = _make_tx(points=-150, reason="redemption")

        with patch("app.services.loyalty.LoyaltyTransaction", return_value=mock_tx):
            tx = await LoyaltyService.redeem_points(db, user.id, 150)

        assert tx.points == -150
        db.commit.assert_awaited_once()

    @pytest.mark.anyio
    async def test_insufficient_balance_raises_bad_request(self):
        db = _make_db()
        user = _make_user(loyalty_points=50)
        db.execute.return_value = _exec_result(user)

        with pytest.raises(BadRequestError, match="Insufficient"):
            await LoyaltyService.redeem_points(db, user.id, 200)

    @pytest.mark.anyio
    async def test_zero_amount_raises_bad_request(self):
        db = _make_db()
        with pytest.raises(BadRequestError, match="positive"):
            await LoyaltyService.redeem_points(db, uuid4(), 0)

    @pytest.mark.anyio
    async def test_negative_amount_raises_bad_request(self):
        db = _make_db()
        with pytest.raises(BadRequestError, match="positive"):
            await LoyaltyService.redeem_points(db, uuid4(), -5)

    @pytest.mark.anyio
    async def test_member_not_found_raises_not_found(self):
        db = _make_db()
        db.execute.return_value = _exec_result(None)

        with pytest.raises(NotFoundError):
            await LoyaltyService.redeem_points(db, uuid4(), 50)

    @pytest.mark.anyio
    async def test_exact_balance_amount_succeeds(self):
        db = _make_db()
        user = _make_user(loyalty_points=200)
        db.execute.return_value = _exec_result(user)
        mock_tx = _make_tx(points=-200)

        with patch("app.services.loyalty.LoyaltyTransaction", return_value=mock_tx):
            tx = await LoyaltyService.redeem_points(db, user.id, 200)

        assert tx.points == -200


# ── get_balance ───────────────────────────────────────────────────────────────


class TestGetBalance:
    @pytest.mark.anyio
    async def test_returns_balance_and_lifetime_dict(self):
        db = _make_db()
        user = _make_user(loyalty_points=300, loyalty_lifetime_points=800)
        db.execute.return_value = _exec_result(user)

        result = await LoyaltyService.get_balance(db, user.id)

        assert result == {"balance": 300, "lifetime_total": 800}

    @pytest.mark.anyio
    async def test_member_not_found_raises_not_found(self):
        db = _make_db()
        db.execute.return_value = _exec_result(None)

        with pytest.raises(NotFoundError):
            await LoyaltyService.get_balance(db, uuid4())


# ── get_transactions ──────────────────────────────────────────────────────────


class TestGetTransactions:
    @pytest.mark.anyio
    async def test_returns_list_of_transactions(self):
        db = _make_db()
        tx1 = _make_tx(points=50)
        tx2 = _make_tx(points=-150, reason="redemption")
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [tx1, tx2]
        db.execute.return_value = mock_result

        txs = await LoyaltyService.get_transactions(db, uuid4(), limit=10)

        assert len(txs) == 2

    @pytest.mark.anyio
    async def test_empty_history(self):
        db = _make_db()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute.return_value = mock_result

        txs = await LoyaltyService.get_transactions(db, uuid4())

        assert txs == []


# ── get_leaderboard ───────────────────────────────────────────────────────────


class TestGetLeaderboard:
    @pytest.mark.anyio
    async def test_returns_formatted_ranked_list(self):
        db = _make_db()
        user = _make_user(loyalty_points=100, loyalty_lifetime_points=500)
        user.full_name = "Top Member"
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [user]
        db.execute.return_value = mock_result

        board = await LoyaltyService.get_leaderboard(db, limit=5)

        assert len(board) == 1
        entry = board[0]
        assert entry["rank"] == 1
        assert entry["full_name"] == "Top Member"
        assert entry["lifetime_points"] == 500
        assert entry["current_balance"] == 100

    @pytest.mark.anyio
    async def test_empty_leaderboard(self):
        db = _make_db()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute.return_value = mock_result

        board = await LoyaltyService.get_leaderboard(db)

        assert board == []

    @pytest.mark.anyio
    async def test_multiple_entries_ranked_correctly(self):
        db = _make_db()
        u1 = _make_user(loyalty_points=500, loyalty_lifetime_points=1000)
        u1.full_name = "Alice"
        u2 = _make_user(loyalty_points=200, loyalty_lifetime_points=600)
        u2.full_name = "Bob"
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [u1, u2]
        db.execute.return_value = mock_result

        board = await LoyaltyService.get_leaderboard(db)

        assert board[0]["rank"] == 1
        assert board[0]["full_name"] == "Alice"
        assert board[1]["rank"] == 2
        assert board[1]["full_name"] == "Bob"
