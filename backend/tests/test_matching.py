"""Unit tests for app/services/matching.py."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.services.matching import MatchingEngine


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_user(
    *,
    interests=None,
    industry=None,
    revenue_range=None,
    segment_groups=None,
    bio=None,
    id=None,
    full_name="Test User",
    email="test@example.com",
    tier="gold",
    role="user",
    is_active=True,
    company_name=None,
):
    """Build a minimal mock User object."""
    user = MagicMock()
    user.id = id or uuid4()
    user.full_name = full_name
    user.email = email
    user.tier = tier
    user.role = role
    user.is_active = is_active
    user.interests = interests or []
    user.industry = industry or ""
    user.bio = bio or ""
    user.revenue_range = revenue_range or ""
    user.segment_groups = segment_groups or []
    user.company_name = company_name or ""
    return user


# ── calculate_segments ────────────────────────────────────────────────────────


class TestCalculateSegments:
    def test_finance_interest_adds_finance_segment(self):
        user = _make_user(interests=["finance", "art"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Finance & Investors" in segments

    def test_investment_interest_adds_finance_segment(self):
        user = _make_user(interests=["investment"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Finance & Investors" in segments

    def test_finance_industry_adds_finance_segment(self):
        user = _make_user(industry="finance")
        segments = MatchingEngine.calculate_segments(user)
        assert "Finance & Investors" in segments

    def test_tech_industry_adds_tech_segment(self):
        user = _make_user(industry="tech")
        segments = MatchingEngine.calculate_segments(user)
        assert "Tech & Founders" in segments

    def test_technology_interest_adds_tech_segment(self):
        user = _make_user(interests=["technology"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Tech & Founders" in segments

    def test_startup_interest_adds_tech_segment(self):
        user = _make_user(interests=["startup"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Tech & Founders" in segments

    def test_real_estate_interest_adds_real_estate_segment(self):
        user = _make_user(interests=["real estate"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Real Estate" in segments

    def test_property_interest_adds_real_estate_segment(self):
        user = _make_user(interests=["property"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Real Estate" in segments

    def test_lifestyle_interest_adds_lifestyle_segment(self):
        user = _make_user(interests=["lifestyle"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Lifestyle & Leisure" in segments

    def test_legal_interest_adds_legal_segment(self):
        user = _make_user(interests=["legal"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Legal & Advisory" in segments

    def test_consulting_interest_adds_legal_segment(self):
        user = _make_user(interests=["consulting"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Legal & Advisory" in segments

    def test_no_matching_profile_returns_empty(self):
        user = _make_user()
        segments = MatchingEngine.calculate_segments(user)
        assert segments == []

    def test_none_interests_returns_empty(self):
        user = _make_user(interests=None)
        segments = MatchingEngine.calculate_segments(user)
        assert isinstance(segments, list)

    def test_multiple_matching_interests_returns_multiple_segments(self):
        user = _make_user(interests=["finance", "technology", "luxury"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Finance & Investors" in segments
        assert "Tech & Founders" in segments
        assert "Lifestyle & Leisure" in segments

    def test_returns_list_type(self):
        user = _make_user(interests=["finance"])
        result = MatchingEngine.calculate_segments(user)
        assert isinstance(result, list)

    def test_case_insensitive_matching(self):
        user = _make_user(interests=["Finance"])
        segments = MatchingEngine.calculate_segments(user)
        assert "Finance & Investors" in segments


# ── get_suggested_connections ─────────────────────────────────────────────────


class TestGetSuggestedConnections:
    @pytest.mark.anyio
    async def test_returns_empty_when_segment_groups_is_empty(self):
        db = AsyncMock()
        user = _make_user(segment_groups=[])
        result = await MatchingEngine.get_suggested_connections(db, user)
        assert result == []
        db.execute.assert_not_called()

    @pytest.mark.anyio
    async def test_returns_empty_when_segment_groups_is_none(self):
        db = AsyncMock()
        user = _make_user()
        user.segment_groups = None
        # Coerce to falsy — engine checks `if not user.segment_groups`
        user.segment_groups = []
        result = await MatchingEngine.get_suggested_connections(db, user)
        assert result == []

    @pytest.mark.anyio
    async def test_returns_candidates_sorted_by_score(self):
        """Candidates with more shared segments should rank higher."""
        user = _make_user(
            id=uuid4(),
            segment_groups=["Tech & Founders", "Finance & Investors", "Lifestyle & Leisure"],
        )

        candidate_low = _make_user(
            id=uuid4(),
            full_name="Low Score",
            tier="silver",
            company_name="Low Co",
            industry="art",
            segment_groups=["Lifestyle & Leisure"],
        )
        candidate_high = _make_user(
            id=uuid4(),
            full_name="High Score",
            tier="gold",
            company_name="High Co",
            industry="fintech",
            segment_groups=["Tech & Founders", "Finance & Investors"],
        )

        db = AsyncMock()

        # First db.execute call → connections query
        conn_result = MagicMock()
        conn_result.scalars.return_value.all.return_value = []  # no existing connections

        # Second db.execute call → candidates query
        candidate_result = MagicMock()
        candidate_result.scalars.return_value.all.return_value = [
            candidate_low,
            candidate_high,
        ]

        db.execute = AsyncMock(side_effect=[conn_result, candidate_result])

        result = await MatchingEngine.get_suggested_connections(db, user, limit=5)

        assert len(result) == 2
        # Higher score should be first
        assert result[0]["full_name"] == "High Score"
        assert result[0]["score"] == 2
        assert result[1]["full_name"] == "Low Score"
        assert result[1]["score"] == 1

    @pytest.mark.anyio
    async def test_result_contains_required_keys(self):
        user = _make_user(segment_groups=["Tech & Founders"])

        candidate = _make_user(
            id=uuid4(),
            full_name="Jane Doe",
            tier="platinum",
            company_name="Acme Ltd",
            industry="software",
            segment_groups=["Tech & Founders"],
        )

        db = AsyncMock()
        conn_result = MagicMock()
        conn_result.scalars.return_value.all.return_value = []
        candidate_result = MagicMock()
        candidate_result.scalars.return_value.all.return_value = [candidate]
        db.execute = AsyncMock(side_effect=[conn_result, candidate_result])

        result = await MatchingEngine.get_suggested_connections(db, user, limit=5)

        assert len(result) == 1
        entry = result[0]
        assert "member_id" in entry
        assert "full_name" in entry
        assert "tier" in entry
        assert "company_name" in entry
        assert "industry" in entry
        assert "shared_segments" in entry
        assert "score" in entry

    @pytest.mark.anyio
    async def test_respects_limit_parameter(self):
        user = _make_user(segment_groups=["Tech & Founders"])

        candidates = [
            _make_user(id=uuid4(), full_name=f"User {i}", segment_groups=["Tech & Founders"])
            for i in range(10)
        ]

        db = AsyncMock()
        conn_result = MagicMock()
        conn_result.scalars.return_value.all.return_value = []
        candidate_result = MagicMock()
        candidate_result.scalars.return_value.all.return_value = candidates
        db.execute = AsyncMock(side_effect=[conn_result, candidate_result])

        result = await MatchingEngine.get_suggested_connections(db, user, limit=3)

        assert len(result) == 3


# ── generate_networking_report ────────────────────────────────────────────────


class TestGenerateNetworkingReport:
    @pytest.mark.anyio
    async def test_returns_all_required_keys(self):
        user = _make_user(
            segment_groups=["Tech & Founders"],
            bio="Building the future.",
        )

        db = AsyncMock()

        # db.scalar calls for: connection count, total_spent, match_score_count
        db.scalar = AsyncMock(side_effect=[3, Decimal("1500.00"), 12])

        # db.execute call for event RSVP count
        rsvp_result = MagicMock()
        rsvp_result.scalar.return_value = 5
        db.execute = AsyncMock(return_value=rsvp_result)

        report = await MatchingEngine.generate_networking_report(db, user)

        required_keys = {
            "connections_count",
            "events_attended",
            "total_spent",
            "top_segments",
            "suggested_next_steps",
            "match_score_count",
        }
        assert required_keys.issubset(report.keys())

    @pytest.mark.anyio
    async def test_connections_count_is_integer(self):
        user = _make_user(segment_groups=["Tech & Founders"], bio="Bio here.")

        db = AsyncMock()
        db.scalar = AsyncMock(side_effect=[7, Decimal("200.00"), 5])
        rsvp_result = MagicMock()
        rsvp_result.scalar.return_value = 4
        db.execute = AsyncMock(return_value=rsvp_result)

        report = await MatchingEngine.generate_networking_report(db, user)

        assert report["connections_count"] == 7
        assert isinstance(report["connections_count"], int)

    @pytest.mark.anyio
    async def test_suggested_steps_when_profile_incomplete(self):
        """User with sparse profile should get actionable suggestions."""
        user = _make_user(segment_groups=[], bio="")

        db = AsyncMock()
        # connections=0, total_spent=0, match_score_count not reached (no segments)
        db.scalar = AsyncMock(side_effect=[0, Decimal("0.00")])
        rsvp_result = MagicMock()
        rsvp_result.scalar.return_value = 0
        db.execute = AsyncMock(return_value=rsvp_result)

        report = await MatchingEngine.generate_networking_report(db, user)

        assert len(report["suggested_next_steps"]) >= 1

    @pytest.mark.anyio
    async def test_total_spent_as_float(self):
        user = _make_user(segment_groups=["Finance & Investors"], bio="Hi.")

        db = AsyncMock()
        db.scalar = AsyncMock(side_effect=[1, Decimal("999.50"), 3])
        rsvp_result = MagicMock()
        rsvp_result.scalar.return_value = 10
        db.execute = AsyncMock(return_value=rsvp_result)

        report = await MatchingEngine.generate_networking_report(db, user)

        assert isinstance(report["total_spent"], float)
        assert report["total_spent"] == pytest.approx(999.50)

    @pytest.mark.anyio
    async def test_top_segments_reflects_user_segment_groups(self):
        segments = ["Tech & Founders", "Finance & Investors"]
        user = _make_user(segment_groups=segments, bio="Founder.")

        db = AsyncMock()
        db.scalar = AsyncMock(side_effect=[2, Decimal("500.00"), 8])
        rsvp_result = MagicMock()
        rsvp_result.scalar.return_value = 3
        db.execute = AsyncMock(return_value=rsvp_result)

        report = await MatchingEngine.generate_networking_report(db, user)

        assert set(report["top_segments"]) == set(segments)
