"""Unit tests for Phase 6A+6D MatchingEngine extensions.

Covers:
  - get_enhanced_suggestions (multi-factor scoring)
  - get_weekly_digest
  - get_deal_flow_pairs
  - get_connection_gap_analysis
  - refresh_segment_scores
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.matching import MatchingEngine


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_user(
    *,
    id=None,
    full_name="Test User",
    tier="gold",
    company_name=None,
    industry=None,
    segment_groups=None,
    last_seen_at=None,
    is_active=True,
    is_superuser=False,
    interests=None,
    revenue_range=None,
):
    user = MagicMock()
    user.id = id or uuid4()
    user.full_name = full_name
    user.tier = tier
    user.company_name = company_name or ""
    user.industry = industry or ""
    user.segment_groups = segment_groups or []
    user.last_seen_at = last_seen_at
    user.is_active = is_active
    user.is_superuser = is_superuser
    user.interests = interests or []
    user.revenue_range = revenue_range or ""
    return user


def _empty_execute(scalars_list=None):
    """Return a mock db.execute result whose .scalars().all() is the given list."""
    mock = MagicMock()
    mock.scalars.return_value.all.return_value = scalars_list or []
    return mock


def _fetchall_execute(rows=None):
    """Return a mock db.execute result whose .fetchall() is the given rows."""
    mock = MagicMock()
    mock.fetchall.return_value = rows or []
    return mock


def _scalar_execute(value=None):
    """Return a mock db.execute result whose .scalar() returns the given value."""
    mock = MagicMock()
    mock.scalar.return_value = value or 0
    return mock


# ── get_enhanced_suggestions ──────────────────────────────────────────────────


class TestGetEnhancedSuggestions:
    @pytest.mark.anyio
    async def test_returns_empty_when_no_segment_groups(self):
        db = AsyncMock()
        user = _make_user(segment_groups=[])
        result = await MatchingEngine.get_enhanced_suggestions(db, user)
        assert result == []
        db.execute.assert_not_called()

    @pytest.mark.anyio
    async def test_returns_required_keys(self):
        user = _make_user(segment_groups=["Tech & Founders"])
        candidate = _make_user(
            id=uuid4(),
            segment_groups=["Tech & Founders"],
            last_seen_at=None,
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),          # 1. existing connections
                _empty_execute([candidate]), # 2. candidates from DB
                _empty_execute([]),          # 3. in-venue check
                _fetchall_execute([]),       # 4. user RSVPs
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)

        assert len(result) == 1
        entry = result[0]
        required = {
            "member_id", "full_name", "tier", "company_name",
            "industry", "shared_segments", "shared_events_count",
            "score", "reason_text", "is_in_venue",
        }
        assert required.issubset(entry.keys())

    @pytest.mark.anyio
    async def test_segment_score_is_2_per_shared_segment(self):
        """Each shared segment contributes 2.0 to the score.

        Use segments that are NOT in COMPLEMENTARY_PAIRS so only the segment
        factor applies: 2 shared × 2.0 = 4.0.
        "Tech & Founders" ↔ "Lifestyle & Leisure" has no complementary bonus.
        """
        user = _make_user(segment_groups=["Tech & Founders", "Lifestyle & Leisure"])
        candidate = _make_user(
            id=uuid4(),
            segment_groups=["Tech & Founders", "Lifestyle & Leisure"],
            last_seen_at=None,
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),
                _empty_execute([candidate]),
                _empty_execute([]),
                _fetchall_execute([]),
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)
        assert len(result) == 1
        # 2 shared segments × 2.0 = 4.0 (no complementary bonus for these segments)
        assert result[0]["score"] == 4.0
        assert len(result[0]["shared_segments"]) == 2

    @pytest.mark.anyio
    async def test_in_venue_adds_1_to_score(self):
        """Candidate who tapped in the last 6h gets +1.0 to score."""
        candidate_id = uuid4()
        user = _make_user(segment_groups=["Tech & Founders"])
        candidate = _make_user(
            id=candidate_id,
            segment_groups=["Tech & Founders"],
            last_seen_at=None,
        )

        # venue_result returns candidate_id (they tapped recently)
        venue_result = MagicMock()
        venue_result.scalars.return_value.all.return_value = [candidate_id]

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),
                _empty_execute([candidate]),
                venue_result,
                _fetchall_execute([]),
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)
        assert result[0]["is_in_venue"] is True
        # 1 segment × 2.0 + in_venue 1.0 = 3.0
        assert result[0]["score"] == 3.0

    @pytest.mark.anyio
    async def test_complementary_pair_adds_1_to_score(self):
        """Finance & Investors ↔ Tech & Founders is a complementary pair → +1.0."""
        user = _make_user(segment_groups=["Finance & Investors"])
        candidate = _make_user(
            id=uuid4(),
            segment_groups=["Tech & Founders"],
            last_seen_at=None,
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),
                _empty_execute([candidate]),
                _empty_execute([]),
                _fetchall_execute([]),
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)
        assert len(result) == 1
        # 0 shared segments (different segments) + complementary 1.0 = 1.0
        assert result[0]["score"] == 1.0

    @pytest.mark.anyio
    async def test_respects_limit(self):
        user = _make_user(segment_groups=["Tech & Founders"])
        candidates = [
            _make_user(id=uuid4(), segment_groups=["Tech & Founders"], last_seen_at=None)
            for _ in range(8)
        ]

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),
                _empty_execute(candidates),
                _empty_execute([]),
                _fetchall_execute([]),
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=3)
        assert len(result) == 3

    @pytest.mark.anyio
    async def test_excludes_already_connected_members(self):
        """Members already connected should not appear in suggestions."""
        connected_id = uuid4()
        user_id = uuid4()
        user = _make_user(id=user_id, segment_groups=["Tech & Founders"])

        # existing connection where connected_id is the other member
        existing_conn = MagicMock()
        existing_conn.member_a_id = user_id
        existing_conn.member_b_id = connected_id

        db = AsyncMock()
        # Connection query returns the existing connection
        # Candidate query returns empty (already excluded by SQL notin_)
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([existing_conn]),  # existing connections
                _empty_execute([]),               # candidates (SQL filtered them out)
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)
        assert result == []

    @pytest.mark.anyio
    async def test_returns_empty_when_no_candidates(self):
        user = _make_user(segment_groups=["Tech & Founders"])

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),
                _empty_execute([]),  # no candidates
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)
        assert result == []

    @pytest.mark.anyio
    async def test_sorted_by_score_descending(self):
        user = _make_user(segment_groups=["Tech & Founders", "Finance & Investors", "Real Estate"])
        candidate_low = _make_user(
            id=uuid4(),
            full_name="Low Score",
            segment_groups=["Real Estate"],   # 1 shared × 2.0 = 2.0
            last_seen_at=None,
        )
        candidate_high = _make_user(
            id=uuid4(),
            full_name="High Score",
            segment_groups=["Tech & Founders", "Finance & Investors"],  # 2 × 2.0 = 4.0
            last_seen_at=None,
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),
                _empty_execute([candidate_low, candidate_high]),
                _empty_execute([]),
                _fetchall_execute([]),
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)
        assert result[0]["full_name"] == "High Score"
        assert result[1]["full_name"] == "Low Score"
        assert result[0]["score"] > result[1]["score"]

    @pytest.mark.anyio
    async def test_reason_text_includes_in_venue_now(self):
        candidate_id = uuid4()
        user = _make_user(segment_groups=["Tech & Founders"])
        candidate = _make_user(
            id=candidate_id,
            segment_groups=["Tech & Founders"],
            last_seen_at=None,
        )

        venue_result = MagicMock()
        venue_result.scalars.return_value.all.return_value = [candidate_id]

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),
                _empty_execute([candidate]),
                venue_result,
                _fetchall_execute([]),
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)
        assert "In venue now" in result[0]["reason_text"]

    @pytest.mark.anyio
    async def test_member_id_is_string(self):
        user = _make_user(segment_groups=["Tech & Founders"])
        candidate = _make_user(id=uuid4(), segment_groups=["Tech & Founders"])

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),
                _empty_execute([candidate]),
                _empty_execute([]),
                _fetchall_execute([]),
            ]
        )

        result = await MatchingEngine.get_enhanced_suggestions(db, user, limit=5)
        assert isinstance(result[0]["member_id"], str)


# ── get_weekly_digest ─────────────────────────────────────────────────────────


class TestGetWeeklyDigest:
    @pytest.mark.anyio
    async def test_returns_required_keys(self):
        user = _make_user(segment_groups=["Tech & Founders"])

        with patch.object(
            MatchingEngine,
            "get_enhanced_suggestions",
            AsyncMock(return_value=[]),
        ):
            db = AsyncMock()
            result = await MatchingEngine.get_weekly_digest(db, user)

        assert "top_suggestions" in result
        assert "next_steps" in result
        assert "generated_at" in result

    @pytest.mark.anyio
    async def test_next_steps_suggests_profile_update_when_no_segments(self):
        user = _make_user(segment_groups=[])

        db = AsyncMock()
        # get_enhanced_suggestions returns [] immediately because segments empty
        result = await MatchingEngine.get_weekly_digest(db, user)

        assert any("interests" in step.lower() or "update" in step.lower() for step in result["next_steps"])

    @pytest.mark.anyio
    async def test_next_steps_suggests_profile_completion_when_few_suggestions(self):
        """If < 3 suggestions returned, prompt to complete profile."""
        user = _make_user(segment_groups=["Tech & Founders"])

        with patch.object(
            MatchingEngine,
            "get_enhanced_suggestions",
            AsyncMock(return_value=[{"member_id": str(uuid4()), "full_name": "One"}]),
        ):
            db = AsyncMock()
            result = await MatchingEngine.get_weekly_digest(db, user)

        assert any("profile" in step.lower() for step in result["next_steps"])

    @pytest.mark.anyio
    async def test_top_suggestions_limited_to_3(self):
        suggestions = [
            {"member_id": str(uuid4()), "full_name": f"User {i}"}
            for i in range(3)
        ]
        user = _make_user(segment_groups=["Tech & Founders"])

        with patch.object(
            MatchingEngine,
            "get_enhanced_suggestions",
            AsyncMock(return_value=suggestions),
        ):
            db = AsyncMock()
            result = await MatchingEngine.get_weekly_digest(db, user)

        assert len(result["top_suggestions"]) == 3

    @pytest.mark.anyio
    async def test_generated_at_is_datetime(self):
        user = _make_user(segment_groups=["Tech & Founders"])

        with patch.object(
            MatchingEngine,
            "get_enhanced_suggestions",
            AsyncMock(return_value=[]),
        ):
            db = AsyncMock()
            result = await MatchingEngine.get_weekly_digest(db, user)

        assert isinstance(result["generated_at"], datetime)


# ── get_deal_flow_pairs ───────────────────────────────────────────────────────


class TestGetDealFlowPairs:
    @pytest.mark.anyio
    async def test_returns_complementary_pairs(self):
        """A Finance buyer + Tech seller → one pair returned."""
        buyer = _make_user(
            id=uuid4(),
            full_name="Finance Guy",
            segment_groups=["Finance & Investors"],
            tier="gold",
        )
        seller = _make_user(
            id=uuid4(),
            full_name="Tech Founder",
            segment_groups=["Tech & Founders"],
            tier="silver",
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([buyer]),    # buyers query
                _empty_execute([seller]),   # sellers query
                _empty_execute([]),         # all_conns
            ]
        )

        result = await MatchingEngine.get_deal_flow_pairs(db)

        assert len(result) == 1
        assert result[0]["buyer"]["full_name"] == "Finance Guy"
        assert result[0]["seller"]["full_name"] == "Tech Founder"

    @pytest.mark.anyio
    async def test_skips_same_person(self):
        """A user who is both buyer and seller should not be paired with itself."""
        both_id = uuid4()
        both = _make_user(
            id=both_id,
            segment_groups=["Finance & Investors", "Tech & Founders"],
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([both]),  # buyers
                _empty_execute([both]),  # sellers (same user)
                _empty_execute([]),      # all_conns
            ]
        )

        result = await MatchingEngine.get_deal_flow_pairs(db)
        assert result == []

    @pytest.mark.anyio
    async def test_no_pairs_when_no_buyers(self):
        seller = _make_user(id=uuid4(), segment_groups=["Tech & Founders"])

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),       # buyers: empty
                _empty_execute([seller]), # sellers
                _empty_execute([]),       # all_conns
            ]
        )

        result = await MatchingEngine.get_deal_flow_pairs(db)
        assert result == []

    @pytest.mark.anyio
    async def test_pair_contains_required_keys(self):
        buyer = _make_user(id=uuid4(), segment_groups=["Finance & Investors"])
        seller = _make_user(id=uuid4(), segment_groups=["Tech & Founders"])

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([buyer]),
                _empty_execute([seller]),
                _empty_execute([]),
            ]
        )

        result = await MatchingEngine.get_deal_flow_pairs(db)

        assert len(result) == 1
        pair = result[0]
        assert "buyer" in pair
        assert "seller" in pair
        assert "mutual_connections" in pair
        assert "score" in pair
        assert "member_id" in pair["buyer"]
        assert "member_id" in pair["seller"]

    @pytest.mark.anyio
    async def test_no_duplicate_pairs(self):
        """When buyer and seller each have multiple segments, only one pair is created."""
        buyer = _make_user(id=uuid4(), segment_groups=["Finance & Investors", "Real Estate"])
        seller = _make_user(id=uuid4(), segment_groups=["Tech & Founders"])

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([buyer]),
                _empty_execute([seller]),
                _empty_execute([]),
            ]
        )

        result = await MatchingEngine.get_deal_flow_pairs(db)
        # Should be exactly 1 pair (not 2 due to dedup by `seen` set)
        assert len(result) == 1


# ── get_connection_gap_analysis ───────────────────────────────────────────────


class TestGetConnectionGapAnalysis:
    @pytest.mark.anyio
    async def test_returns_empty_structure_when_no_segments(self):
        user = _make_user(segment_groups=[])
        db = AsyncMock()

        result = await MatchingEngine.get_connection_gap_analysis(db, user)

        assert result["user_segments"] == []
        assert result["connected_segments"] == {}
        assert result["missing_or_weak_segments"] == []
        assert result["priority_suggestions"] == []
        db.execute.assert_not_called()

    @pytest.mark.anyio
    async def test_segment_with_zero_connections_is_weak(self):
        """A segment the user has but none of their connections share is a gap."""
        user = _make_user(segment_groups=["Tech & Founders", "Real Estate"])

        # User has no connections at all
        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([]),   # user connections: empty
            ]
        )

        with patch.object(
            MatchingEngine,
            "get_enhanced_suggestions",
            AsyncMock(return_value=[]),
        ):
            result = await MatchingEngine.get_connection_gap_analysis(db, user)

        assert set(result["missing_or_weak_segments"]) == {"Tech & Founders", "Real Estate"}
        assert result["connected_segments"] == {}

    @pytest.mark.anyio
    async def test_segment_with_one_connection_is_weak(self):
        """A segment with exactly 1 connection counts as weak (threshold < 2)."""
        user_id = uuid4()
        user = _make_user(id=user_id, segment_groups=["Finance & Investors"])
        connected_id = uuid4()

        conn = MagicMock()
        conn.member_a_id = user_id
        conn.member_b_id = connected_id

        connected_member = _make_user(
            id=connected_id,
            segment_groups=["Finance & Investors"],
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([conn]),              # user's connections
                _empty_execute([connected_member]),  # connected member profiles
            ]
        )

        with patch.object(
            MatchingEngine,
            "get_enhanced_suggestions",
            AsyncMock(return_value=[]),
        ):
            result = await MatchingEngine.get_connection_gap_analysis(db, user)

        # 1 connection in "Finance & Investors" < 2 → still weak
        assert "Finance & Investors" in result["missing_or_weak_segments"]
        assert result["connected_segments"].get("Finance & Investors", 0) == 1

    @pytest.mark.anyio
    async def test_segment_with_two_connections_is_not_weak(self):
        """2 or more connections in a segment means it's adequately covered."""
        user_id = uuid4()
        user = _make_user(id=user_id, segment_groups=["Finance & Investors"])

        conn1, conn2 = MagicMock(), MagicMock()
        cid1, cid2 = uuid4(), uuid4()
        conn1.member_a_id = user_id
        conn1.member_b_id = cid1
        conn2.member_a_id = user_id
        conn2.member_b_id = cid2

        cm1 = _make_user(id=cid1, segment_groups=["Finance & Investors"])
        cm2 = _make_user(id=cid2, segment_groups=["Finance & Investors"])

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _empty_execute([conn1, conn2]),
                _empty_execute([cm1, cm2]),
            ]
        )

        result = await MatchingEngine.get_connection_gap_analysis(db, user)

        assert "Finance & Investors" not in result["missing_or_weak_segments"]
        assert result["connected_segments"]["Finance & Investors"] == 2

    @pytest.mark.anyio
    async def test_user_segments_present_in_output(self):
        user = _make_user(segment_groups=["Tech & Founders"])
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[_empty_execute([])])

        with patch.object(
            MatchingEngine,
            "get_enhanced_suggestions",
            AsyncMock(return_value=[]),
        ):
            result = await MatchingEngine.get_connection_gap_analysis(db, user)

        assert "Tech & Founders" in result["user_segments"]


# ── refresh_segment_scores ────────────────────────────────────────────────────


class TestRefreshSegmentScores:
    @pytest.mark.anyio
    async def test_updates_user_segment_groups(self):
        user = _make_user(interests=["finance", "technology"])
        db = AsyncMock()

        await MatchingEngine.refresh_segment_scores(db, user)

        assert "Finance & Investors" in user.segment_groups
        assert "Tech & Founders" in user.segment_groups

    @pytest.mark.anyio
    async def test_calls_db_add(self):
        user = _make_user(interests=["finance"])
        db = AsyncMock()

        await MatchingEngine.refresh_segment_scores(db, user)

        db.add.assert_called_once_with(user)

    @pytest.mark.anyio
    async def test_empty_interests_clears_segments(self):
        user = _make_user(interests=[], segment_groups=["Tech & Founders"])
        db = AsyncMock()

        await MatchingEngine.refresh_segment_scores(db, user)

        assert user.segment_groups == []

    @pytest.mark.anyio
    async def test_recalculates_based_on_interests(self):
        user = _make_user(interests=["legal"])
        db = AsyncMock()

        await MatchingEngine.refresh_segment_scores(db, user)

        assert user.segment_groups == ["Legal & Advisory"]
