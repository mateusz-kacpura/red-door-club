"""Unit tests for Phase 6C: app/services/churn.py.

Covers:
  - _risk_level helper
  - ChurnPredictionEngine.get_churn_score (all 5 factors + score cap)
  - ChurnPredictionEngine.get_at_risk_members
  - ChurnPredictionEngine.get_retention_overview
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.churn import ChurnPredictionEngine, _risk_level


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_member(
    *,
    id=None,
    full_name="Test Member",
    tier="gold",
    company_name="Acme",
    last_seen_at=None,
    is_active=True,
    is_superuser=False,
):
    m = MagicMock()
    m.id = id or uuid4()
    m.full_name = full_name
    m.tier = tier
    m.company_name = company_name
    m.last_seen_at = last_seen_at
    m.is_active = is_active
    m.is_superuser = is_superuser
    return m


def _build_churn_db(
    *,
    taps_recent: int = 0,
    taps_prev: int = 0,
    recent_earning: int = 0,
    rsvp_count: int = 0,
    recent_spending: float = 0.0,
):
    """Build an AsyncMock db session preconfigured for get_churn_score DB calls.

    Call order (inside get_churn_score):
      1. db.scalar → taps_recent (SELECT COUNT TapEvent last 30d)
      2. db.scalar → taps_prev   (SELECT COUNT TapEvent 30-60d)
      3. db.scalar → recent_earning (SELECT COUNT LoyaltyTransaction last 30d)
      4. db.execute → rsvp_result.scalar() = rsvp_count
      5. db.scalar → recent_spending (SELECT SUM Tab)
    """
    db = AsyncMock()

    rsvp_result = MagicMock()
    rsvp_result.scalar.return_value = rsvp_count

    db.scalar = AsyncMock(
        side_effect=[taps_recent, taps_prev, recent_earning, Decimal(str(recent_spending))]
    )
    db.execute = AsyncMock(return_value=rsvp_result)
    return db


# ── _risk_level ───────────────────────────────────────────────────────────────


class TestRiskLevel:
    def test_score_0_is_healthy(self):
        assert _risk_level(0) == "healthy"

    def test_score_20_is_healthy(self):
        assert _risk_level(20) == "healthy"

    def test_score_21_is_low(self):
        assert _risk_level(21) == "low"

    def test_score_40_is_low(self):
        assert _risk_level(40) == "low"

    def test_score_41_is_medium(self):
        assert _risk_level(41) == "medium"

    def test_score_60_is_medium(self):
        assert _risk_level(60) == "medium"

    def test_score_61_is_high(self):
        assert _risk_level(61) == "high"

    def test_score_80_is_high(self):
        assert _risk_level(80) == "high"

    def test_score_81_is_critical(self):
        assert _risk_level(81) == "critical"

    def test_score_100_is_critical(self):
        assert _risk_level(100) == "critical"


# ── get_churn_score ───────────────────────────────────────────────────────────


class TestGetChurnScore:
    @pytest.mark.anyio
    async def test_returns_required_keys(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        assert {"score", "risk_level", "factors", "recommendation"} == set(result.keys())

    @pytest.mark.anyio
    async def test_active_today_has_zero_days_since_last_seen_score(self):
        """Member active today: days_away=0 → dsls_score=0."""
        now = datetime.now(timezone.utc)
        member = _make_member(last_seen_at=now)
        db = _build_churn_db(taps_recent=10, taps_prev=10, recent_earning=2, rsvp_count=2, recent_spending=1000.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        dsls_factor = next(f for f in result["factors"] if f["name"] == "days_since_last_seen")
        assert dsls_factor["impact"] == 0
        assert result["risk_level"] == "healthy"

    @pytest.mark.anyio
    async def test_last_seen_15_days_ago_scores_10(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc) - timedelta(days=15))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        dsls_factor = next(f for f in result["factors"] if f["name"] == "days_since_last_seen")
        assert dsls_factor["impact"] == 10

    @pytest.mark.anyio
    async def test_last_seen_45_days_ago_scores_30(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc) - timedelta(days=45))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        dsls_factor = next(f for f in result["factors"] if f["name"] == "days_since_last_seen")
        assert dsls_factor["impact"] == 30

    @pytest.mark.anyio
    async def test_last_seen_75_days_ago_scores_50(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc) - timedelta(days=75))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        dsls_factor = next(f for f in result["factors"] if f["name"] == "days_since_last_seen")
        assert dsls_factor["impact"] == 50

    @pytest.mark.anyio
    async def test_last_seen_120_days_ago_scores_70(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc) - timedelta(days=120))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        dsls_factor = next(f for f in result["factors"] if f["name"] == "days_since_last_seen")
        assert dsls_factor["impact"] == 70

    @pytest.mark.anyio
    async def test_never_seen_scores_70(self):
        member = _make_member(last_seen_at=None)
        db = _build_churn_db(taps_recent=0, taps_prev=0, recent_earning=0, rsvp_count=0, recent_spending=0.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        dsls_factor = next(f for f in result["factors"] if f["name"] == "days_since_last_seen")
        assert dsls_factor["impact"] == 70

    @pytest.mark.anyio
    async def test_tap_decline_over_80pct_scores_25(self):
        """taps_prev=10, taps_recent=1 → decline = 90% > 80% → tap_score=25."""
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=1, taps_prev=10, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        tap_factor = next(f for f in result["factors"] if f["name"] == "tap_frequency_decline")
        assert tap_factor["impact"] == 25

    @pytest.mark.anyio
    async def test_tap_decline_between_50_and_80pct_scores_15(self):
        """taps_prev=10, taps_recent=3 → decline = 70% → tap_score=15."""
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=3, taps_prev=10, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        tap_factor = next(f for f in result["factors"] if f["name"] == "tap_frequency_decline")
        assert tap_factor["impact"] == 15

    @pytest.mark.anyio
    async def test_stable_taps_score_0(self):
        """taps_prev=10, taps_recent=10 → decline=0% → tap_score=0."""
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=10, taps_prev=10, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        tap_factor = next(f for f in result["factors"] if f["name"] == "tap_frequency_decline")
        assert tap_factor["impact"] == 0

    @pytest.mark.anyio
    async def test_no_loyalty_earning_adds_10(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=0, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        loy_factor = next(f for f in result["factors"] if f["name"] == "loyalty_earning")
        assert loy_factor["impact"] == 10

    @pytest.mark.anyio
    async def test_has_loyalty_earning_adds_0(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=3, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        loy_factor = next(f for f in result["factors"] if f["name"] == "loyalty_earning")
        assert loy_factor["impact"] == 0

    @pytest.mark.anyio
    async def test_no_rsvp_adds_10(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=0, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        rsvp_factor = next(f for f in result["factors"] if f["name"] == "event_rsvp_activity")
        assert rsvp_factor["impact"] == 10

    @pytest.mark.anyio
    async def test_has_rsvp_adds_0(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=2, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        rsvp_factor = next(f for f in result["factors"] if f["name"] == "event_rsvp_activity")
        assert rsvp_factor["impact"] == 0

    @pytest.mark.anyio
    async def test_zero_spending_adds_5(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=1, recent_spending=0.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        spend_factor = next(f for f in result["factors"] if f["name"] == "spending_activity")
        assert spend_factor["impact"] == 5

    @pytest.mark.anyio
    async def test_has_spending_adds_0(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=1, recent_spending=500.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        spend_factor = next(f for f in result["factors"] if f["name"] == "spending_activity")
        assert spend_factor["impact"] == 0

    @pytest.mark.anyio
    async def test_score_is_clamped_at_100(self):
        """Max raw sum = 70+25+10+10+5 = 120; must be clamped to 100."""
        member = _make_member(last_seen_at=datetime.now(timezone.utc) - timedelta(days=200))
        # Tap decline >80%: prev=10, recent=0
        # No loyalty earning: earning=0
        # No RSVP: rsvp=0
        # No spending: 0
        db = _build_churn_db(
            taps_recent=0,
            taps_prev=10,
            recent_earning=0,
            rsvp_count=0,
            recent_spending=0.0,
        )

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        assert result["score"] == 100
        assert result["score"] <= 100

    @pytest.mark.anyio
    async def test_fully_active_member_is_healthy(self):
        """Member who is active today, tapping, earning points, RSVPed, spending → low score."""
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(
            taps_recent=10,
            taps_prev=10,
            recent_earning=5,
            rsvp_count=3,
            recent_spending=1500.0,
        )

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        assert result["score"] == 0
        assert result["risk_level"] == "healthy"

    @pytest.mark.anyio
    async def test_factors_list_has_5_entries(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db()

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        assert len(result["factors"]) == 5

    @pytest.mark.anyio
    async def test_each_factor_has_required_keys(self):
        member = _make_member(last_seen_at=datetime.now(timezone.utc))
        db = _build_churn_db(taps_recent=5, taps_prev=5, recent_earning=1, rsvp_count=1, recent_spending=100.0)

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        for f in result["factors"]:
            assert "name" in f
            assert "impact" in f
            assert "detail" in f

    @pytest.mark.anyio
    async def test_score_matches_risk_level(self):
        """Computed risk_level must agree with _risk_level(score)."""
        member = _make_member(last_seen_at=datetime.now(timezone.utc) - timedelta(days=45))
        db = _build_churn_db(
            taps_recent=0,
            taps_prev=5,
            recent_earning=0,
            rsvp_count=0,
            recent_spending=0.0,
        )

        result = await ChurnPredictionEngine.get_churn_score(db, member)

        assert result["risk_level"] == _risk_level(result["score"])


# ── get_at_risk_members ───────────────────────────────────────────────────────


class TestGetAtRiskMembers:
    @pytest.mark.anyio
    async def test_excludes_members_below_min_score(self):
        """Members with churn score < min_score should not appear."""
        member_low = _make_member(full_name="Low Risk")
        member_high = _make_member(full_name="High Risk")

        db = AsyncMock()
        exec_result = MagicMock()
        exec_result.scalars.return_value.all.return_value = [member_low, member_high]
        db.execute = AsyncMock(return_value=exec_result)

        low_score = {"score": 20, "risk_level": "healthy", "factors": [{"impact": 0, "name": "x", "detail": "x"}], "recommendation": ""}
        high_score = {"score": 75, "risk_level": "high", "factors": [{"impact": 70, "name": "x", "detail": "x"}], "recommendation": ""}

        with patch.object(
            ChurnPredictionEngine,
            "get_churn_score",
            AsyncMock(side_effect=[low_score, high_score]),
        ):
            result = await ChurnPredictionEngine.get_at_risk_members(db, min_score=40)

        names = [r["full_name"] for r in result]
        assert "High Risk" in names
        assert "Low Risk" not in names

    @pytest.mark.anyio
    async def test_sorted_by_churn_score_descending(self):
        m1 = _make_member(full_name="Medium Risk")
        m2 = _make_member(full_name="Critical Risk")
        m3 = _make_member(full_name="High Risk")

        db = AsyncMock()
        exec_result = MagicMock()
        exec_result.scalars.return_value.all.return_value = [m1, m2, m3]
        db.execute = AsyncMock(return_value=exec_result)

        scores = [
            {"score": 50, "risk_level": "medium", "factors": [{"impact": 50, "name": "x", "detail": "x"}], "recommendation": ""},
            {"score": 95, "risk_level": "critical", "factors": [{"impact": 70, "name": "x", "detail": "x"}], "recommendation": ""},
            {"score": 70, "risk_level": "high", "factors": [{"impact": 70, "name": "x", "detail": "x"}], "recommendation": ""},
        ]

        with patch.object(
            ChurnPredictionEngine,
            "get_churn_score",
            AsyncMock(side_effect=scores),
        ):
            result = await ChurnPredictionEngine.get_at_risk_members(db, min_score=40)

        assert result[0]["full_name"] == "Critical Risk"
        assert result[0]["churn_score"] == 95

    @pytest.mark.anyio
    async def test_returns_required_keys_per_member(self):
        member = _make_member()

        db = AsyncMock()
        exec_result = MagicMock()
        exec_result.scalars.return_value.all.return_value = [member]
        db.execute = AsyncMock(return_value=exec_result)

        score_data = {
            "score": 60,
            "risk_level": "medium",
            "factors": [{"impact": 60, "name": "days_since_last_seen", "detail": "Long absence"}],
            "recommendation": "Re-engage",
        }

        with patch.object(
            ChurnPredictionEngine,
            "get_churn_score",
            AsyncMock(return_value=score_data),
        ):
            result = await ChurnPredictionEngine.get_at_risk_members(db, min_score=40)

        assert len(result) == 1
        entry = result[0]
        required = {"member_id", "full_name", "tier", "company_name", "churn_score", "risk_level", "last_seen_at", "primary_risk_factor"}
        assert required.issubset(entry.keys())

    @pytest.mark.anyio
    async def test_returns_empty_when_no_at_risk_members(self):
        member = _make_member()

        db = AsyncMock()
        exec_result = MagicMock()
        exec_result.scalars.return_value.all.return_value = [member]
        db.execute = AsyncMock(return_value=exec_result)

        score_data = {"score": 10, "risk_level": "healthy", "factors": [{"impact": 0, "name": "x", "detail": "x"}], "recommendation": ""}

        with patch.object(
            ChurnPredictionEngine,
            "get_churn_score",
            AsyncMock(return_value=score_data),
        ):
            result = await ChurnPredictionEngine.get_at_risk_members(db, min_score=40)

        assert result == []


# ── get_retention_overview ────────────────────────────────────────────────────


class TestGetRetentionOverview:
    @pytest.mark.anyio
    async def test_returns_required_keys(self):
        member = _make_member()

        db = AsyncMock()
        # total, active_30d scalars
        db.scalar = AsyncMock(side_effect=[10, 8])
        exec_result = MagicMock()
        exec_result.scalars.return_value.all.return_value = [member]
        db.execute = AsyncMock(return_value=exec_result)

        score_data = {
            "score": 20,
            "risk_level": "healthy",
            "factors": [{"impact": 0, "name": "x", "detail": "x"}],
            "recommendation": "",
        }

        with patch.object(
            ChurnPredictionEngine,
            "get_churn_score",
            AsyncMock(return_value=score_data),
        ):
            result = await ChurnPredictionEngine.get_retention_overview(db)

        required = {"retention_rate_30d", "avg_churn_score", "total_members", "active_30d", "risk_distribution", "at_risk_members"}
        assert required.issubset(result.keys())

    @pytest.mark.anyio
    async def test_retention_rate_calculation(self):
        """retention_rate_30d = active_30d / total × 100."""
        member = _make_member()

        db = AsyncMock()
        db.scalar = AsyncMock(side_effect=[10, 8])  # total=10, active=8
        exec_result = MagicMock()
        exec_result.scalars.return_value.all.return_value = [member]
        db.execute = AsyncMock(return_value=exec_result)

        score_data = {"score": 15, "risk_level": "healthy", "factors": [{"impact": 0, "name": "x", "detail": "x"}], "recommendation": ""}

        with patch.object(
            ChurnPredictionEngine,
            "get_churn_score",
            AsyncMock(return_value=score_data),
        ):
            result = await ChurnPredictionEngine.get_retention_overview(db)

        assert result["total_members"] == 10
        assert result["active_30d"] == 8
        assert result["retention_rate_30d"] == 80.0

    @pytest.mark.anyio
    async def test_zero_total_members_gives_zero_rate(self):
        db = AsyncMock()
        db.scalar = AsyncMock(side_effect=[0, 0])
        exec_result = MagicMock()
        exec_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=exec_result)

        result = await ChurnPredictionEngine.get_retention_overview(db)

        assert result["retention_rate_30d"] == 0.0
        assert result["avg_churn_score"] == 0.0

    @pytest.mark.anyio
    async def test_risk_distribution_has_all_levels(self):
        member = _make_member()

        db = AsyncMock()
        db.scalar = AsyncMock(side_effect=[5, 3])
        exec_result = MagicMock()
        exec_result.scalars.return_value.all.return_value = [member]
        db.execute = AsyncMock(return_value=exec_result)

        score_data = {"score": 45, "risk_level": "medium", "factors": [{"impact": 45, "name": "x", "detail": "x"}], "recommendation": ""}

        with patch.object(
            ChurnPredictionEngine,
            "get_churn_score",
            AsyncMock(return_value=score_data),
        ):
            result = await ChurnPredictionEngine.get_retention_overview(db)

        dist = result["risk_distribution"]
        assert set(dist.keys()) == {"healthy", "low", "medium", "high", "critical"}
