"""Tests for member routes (/api/v1/members/*)."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session
from app.core.config import settings
from app.main import app
from app.schemas.event import EventRead

# Import local service factories from the members route module
from app.api.routes.v1.members import (
    get_event_service as members_get_event_service,
    get_nfc_service as members_get_nfc_service,
    get_user_service as members_get_user_service,
)


class MockUser:
    """Mock member for member route tests."""

    def __init__(self, id=None, email="member@example.com", role="user"):
        self.id = id or uuid4()
        self.email = email
        self.role = role
        self.full_name = "Alice Founder"
        self.company_name = "TechCo Ltd."
        self.industry = "Technology"
        self.revenue_range = None
        self.interests = ["technology", "startup"]
        self.tier = "gold"
        self.is_active = True
        self.is_promoter = False
        self.segment_groups = ["Tech & Founders"]
        self.user_type = "member"
        self.hashed_password = "hashed"
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)

    def has_role(self, required_role) -> bool:
        if self.role == "admin":
            return True
        if hasattr(required_role, "value"):
            return self.role == required_role.value
        return self.role == required_role


def _make_event(**kwargs) -> EventRead:
    now = datetime.now(UTC)
    defaults = dict(
        id=uuid4(),
        title="Test Event",
        description=None,
        event_type="mixer",
        target_segments=[],
        capacity=50,
        ticket_price=Decimal("0.00"),
        starts_at=now,
        ends_at=None,
        status="published",
        min_tier=None,
        rsvp_count=0,
        is_rsvped=False,
        match_score=0.5,
        created_at=now,
        updated_at=now,
    )
    defaults.update(kwargs)
    return EventRead(**defaults)


@pytest.fixture
def mock_user() -> MockUser:
    return MockUser()


@pytest.fixture
def mock_user_service(mock_user: MockUser) -> MagicMock:
    service = MagicMock()
    service.update = AsyncMock(return_value=mock_user)
    return service


@pytest.fixture
def mock_event_service() -> MagicMock:
    service = MagicMock()
    service.list_events = AsyncMock(return_value=[])
    return service


@pytest.fixture
def mock_nfc_service() -> MagicMock:
    service = MagicMock()
    service.get_tap_history = AsyncMock(return_value=[])
    return service


@pytest.fixture
async def member_client(
    mock_user: MockUser,
    mock_user_service: MagicMock,
    mock_event_service: MagicMock,
    mock_nfc_service: MagicMock,
    mock_redis,
    mock_db_session,
) -> AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[members_get_user_service] = lambda: mock_user_service
    app.dependency_overrides[members_get_event_service] = lambda: mock_event_service
    app.dependency_overrides[members_get_nfc_service] = lambda: mock_nfc_service
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    # Mock DB execute for connection/service-request queries
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.get = AsyncMock(return_value=None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── GET /me ───────────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_profile(member_client: AsyncClient, mock_user: MockUser):
    """GET /members/me returns the current user profile."""
    response = await member_client.get(f"{settings.API_V1_STR}/members/me")

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == mock_user.email
    assert data["full_name"] == mock_user.full_name


# ── PATCH /me ─────────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_update_my_profile(
    member_client: AsyncClient,
    mock_user: MockUser,
    mock_user_service: MagicMock,
):
    """PATCH /members/me calls user_service.update and returns updated profile."""
    mock_user.full_name = "Alice Updated"
    mock_user_service.update.return_value = mock_user

    response = await member_client.patch(
        f"{settings.API_V1_STR}/members/me",
        json={"full_name": "Alice Updated"},
    )

    assert response.status_code == 200
    mock_user_service.update.assert_called_once()


# ── GET /me/events ────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_events_empty(member_client: AsyncClient, mock_event_service: MagicMock):
    """GET /members/me/events returns empty list."""
    mock_event_service.list_events.return_value = []

    response = await member_client.get(f"{settings.API_V1_STR}/members/me/events")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_get_my_events_with_data(member_client: AsyncClient, mock_event_service: MagicMock):
    """GET /members/me/events returns personalised event list."""
    event = _make_event(title="Finance Summit", match_score=1.0)
    mock_event_service.list_events.return_value = [event]

    response = await member_client.get(f"{settings.API_V1_STR}/members/me/events")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Finance Summit"
    assert data[0]["match_score"] == 1.0


# ── GET /me/connections ───────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_connections_empty(member_client: AsyncClient):
    """GET /members/me/connections returns empty list when no connections."""
    response = await member_client.get(f"{settings.API_V1_STR}/members/me/connections")

    assert response.status_code == 200
    assert response.json() == []


# ── GET /me/taps ──────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_taps(member_client: AsyncClient, mock_nfc_service: MagicMock):
    """GET /members/me/taps returns tap history."""
    mock_nfc_service.get_tap_history.return_value = []

    response = await member_client.get(f"{settings.API_V1_STR}/members/me/taps")

    assert response.status_code == 200
    assert response.json() == []
    mock_nfc_service.get_tap_history.assert_called_once()


# ── GET /me/services ──────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_services_empty(member_client: AsyncClient):
    """GET /members/me/services returns empty list."""
    response = await member_client.get(f"{settings.API_V1_STR}/members/me/services")

    assert response.status_code == 200
    assert response.json() == []


# ── POST /me/pre-arrival ──────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_submit_pre_arrival(member_client: AsyncClient, mock_db_session):
    """POST /members/me/pre-arrival creates a service request."""
    from app.db.models.service_request import ServiceRequest

    mock_sr = MagicMock(spec=ServiceRequest)
    mock_sr.id = uuid4()
    mock_sr.member_id = uuid4()
    mock_sr.request_type = "bar"
    mock_sr.status = "pending"
    mock_sr.details = {"notes": "Whisky sour please"}
    mock_sr.assigned_to = None
    mock_sr.completed_at = None
    mock_sr.member_rating = None
    mock_sr.created_at = datetime.now(UTC)
    mock_sr.updated_at = datetime.now(UTC)

    # The route calls sr_repo.create which uses the db session
    # Patch sr_repo.create to return mock_sr
    with MagicMock() as mock_repo_module:
        import app.api.routes.v1.members as members_module
        import app.repositories.service_request as sr_repo_module

        original_create = sr_repo_module.create
        sr_repo_module.create = AsyncMock(return_value=mock_sr)

        try:
            response = await member_client.post(
                f"{settings.API_V1_STR}/members/me/pre-arrival",
                json={
                    "request_type": "bar",
                    "details": {"notes": "Whisky sour please"},
                },
            )
        finally:
            sr_repo_module.create = original_create

    assert response.status_code == 201


# ── GET /me/locker ────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_locker_none(member_client: AsyncClient):
    """GET /members/me/locker returns null when no locker assigned."""
    with patch("app.repositories.locker.get_by_member", AsyncMock(return_value=None)):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/locker")

    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.anyio
async def test_get_my_locker_assigned(member_client: AsyncClient):
    """GET /members/me/locker returns locker data when assigned."""
    from app.schemas.locker import LockerRead

    locker = LockerRead(
        id=uuid4(),
        locker_number="A01",
        location="main_floor",
        status="occupied",
        assigned_member_id=uuid4(),
        assigned_at=datetime.now(UTC),
        released_at=None,
    )

    with patch("app.repositories.locker.get_by_member", AsyncMock(return_value=locker)):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/locker")

    assert response.status_code == 200
    data = response.json()
    assert data["locker_number"] == "A01"
    assert data["status"] == "occupied"


# ── GET /me/tab ───────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_tab_none(member_client: AsyncClient):
    """GET /members/me/tab returns null when no open tab."""
    with patch("app.repositories.tab.get_open_tab", AsyncMock(return_value=None)):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/tab")

    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.anyio
async def test_get_my_tab_open(member_client: AsyncClient, mock_user: MockUser):
    """GET /members/me/tab returns open tab data."""
    from decimal import Decimal
    from app.schemas.tab import TabRead

    tab = TabRead(
        id=uuid4(),
        member_id=mock_user.id,
        status="open",
        opened_at=datetime.now(UTC),
        closed_at=None,
        total_amount=Decimal("350.00"),
        items=[],
    )

    with patch("app.repositories.tab.get_open_tab", AsyncMock(return_value=tab)):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/tab")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "open"
    assert float(data["total_amount"]) == 350.0
    assert data["items"] == []


# ── GET /me/suggestions ───────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_suggestions_empty(member_client: AsyncClient, mock_user: MockUser):
    """When segment_groups yields no matches, the endpoint returns an empty list."""
    with patch(
        "app.services.matching.MatchingEngine.get_enhanced_suggestions",
        AsyncMock(return_value=[]),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/suggestions")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_get_my_suggestions_returns_matches(member_client: AsyncClient, mock_user: MockUser):
    """When MatchingEngine returns results, the endpoint surfaces them."""
    fake_suggestion = {
        "member_id": str(uuid4()),
        "full_name": "Jane Doe",
        "tier": "gold",
        "company_name": "Acme Corp",
        "industry": "software",
        "shared_segments": ["Tech & Founders"],
        "shared_events_count": 0,
        "score": 1,
        "reason_text": "Shares Tech & Founders",
        "is_in_venue": False,
    }

    with patch(
        "app.services.matching.MatchingEngine.get_enhanced_suggestions",
        AsyncMock(return_value=[fake_suggestion]),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/suggestions")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["full_name"] == "Jane Doe"
    assert data[0]["score"] == 1


# ── GET /me/networking-report ─────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_networking_report(member_client: AsyncClient, mock_user: MockUser):
    """The networking report endpoint returns a response with all required keys."""
    fake_report = {
        "connections_count": 3,
        "events_attended": 5,
        "total_spent": 1500.0,
        "top_segments": ["Tech & Founders"],
        "suggested_next_steps": ["Keep engaging with the community!"],
        "match_score_count": 12,
    }

    with patch(
        "app.services.matching.MatchingEngine.generate_networking_report",
        AsyncMock(return_value=fake_report),
    ):
        response = await member_client.get(
            f"{settings.API_V1_STR}/members/me/networking-report"
        )

    assert response.status_code == 200
    data = response.json()

    required_keys = {
        "connections_count",
        "events_attended",
        "total_spent",
        "top_segments",
        "suggested_next_steps",
        "match_score_count",
    }
    assert required_keys.issubset(data.keys())
    assert data["connections_count"] == 3
    assert data["events_attended"] == 5


# ── GET /me/tabs/{tab_id}/invoice ─────────────────────────────────────────────


@pytest.mark.anyio
async def test_download_tab_invoice_own_tab(member_client: AsyncClient, mock_user: MockUser):
    """A member can download the PDF invoice for their own closed tab."""
    from decimal import Decimal
    from datetime import datetime, UTC
    from types import SimpleNamespace

    tab_id = uuid4()
    mock_tab = SimpleNamespace(
        id=tab_id,
        member_id=mock_user.id,
        status="closed",
        total_amount=Decimal("500.00"),
        opened_at=datetime.now(UTC),
        closed_at=datetime.now(UTC),
        items=[],
    )

    with patch(
        "app.repositories.tab.get_tab_by_id",
        AsyncMock(return_value=mock_tab),
    ):
        with patch(
            "app.services.invoice.generate_tab_invoice_pdf",
            return_value=b"%PDF-fake-invoice-bytes",
        ):
            response = await member_client.get(
                f"{settings.API_V1_STR}/members/me/tabs/{tab_id}/invoice"
            )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content == b"%PDF-fake-invoice-bytes"


@pytest.mark.anyio
async def test_download_tab_invoice_not_found(member_client: AsyncClient):
    """Requesting an invoice for a non-existent tab returns 404."""
    missing_id = uuid4()

    with patch(
        "app.repositories.tab.get_tab_by_id",
        AsyncMock(return_value=None),
    ):
        response = await member_client.get(
            f"{settings.API_V1_STR}/members/me/tabs/{missing_id}/invoice"
        )

    assert response.status_code == 404


@pytest.mark.anyio
async def test_download_tab_invoice_wrong_owner(member_client: AsyncClient, mock_user: MockUser):
    """Trying to download another member's invoice returns 403."""
    from decimal import Decimal
    from datetime import datetime, UTC
    from types import SimpleNamespace

    tab_id = uuid4()
    other_member_id = uuid4()  # different from mock_user.id

    mock_tab = SimpleNamespace(
        id=tab_id,
        member_id=other_member_id,
        status="closed",
        total_amount=Decimal("250.00"),
        opened_at=datetime.now(UTC),
        closed_at=datetime.now(UTC),
        items=[],
    )

    with patch(
        "app.repositories.tab.get_tab_by_id",
        AsyncMock(return_value=mock_tab),
    ):
        response = await member_client.get(
            f"{settings.API_V1_STR}/members/me/tabs/{tab_id}/invoice"
        )

    assert response.status_code == 403


# ── Phase 5A: Loyalty points endpoints ───────────────────────────────────────


@pytest.mark.anyio
async def test_get_my_points_balance(member_client: AsyncClient, mock_user: MockUser, mock_db_session):
    """GET /members/me/points returns balance dict."""
    from unittest.mock import AsyncMock, MagicMock

    mock_user.loyalty_points = 350
    mock_user.loyalty_lifetime_points = 700

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_user
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await member_client.get(f"{settings.API_V1_STR}/members/me/points")

    assert response.status_code == 200
    data = response.json()
    assert data["balance"] == 350
    assert data["lifetime_total"] == 700


@pytest.mark.anyio
async def test_get_my_points_history_empty(member_client: AsyncClient, mock_db_session):
    """GET /members/me/points/history returns empty list when no transactions."""
    from unittest.mock import AsyncMock, MagicMock

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await member_client.get(f"{settings.API_V1_STR}/members/me/points/history")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_get_my_points_history_with_transactions(member_client: AsyncClient, mock_db_session):
    """GET /members/me/points/history returns serialised transaction list."""
    from datetime import UTC, datetime
    from unittest.mock import AsyncMock, MagicMock
    from uuid import uuid4

    tx = MagicMock()
    tx.id = uuid4()
    tx.member_id = mock_user.id if hasattr(mock_user, "id") else uuid4()
    tx.points = 50
    tx.reason = "event_attendance"
    tx.reference_id = None
    tx.created_at = datetime.now(UTC)

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [tx]
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await member_client.get(f"{settings.API_V1_STR}/members/me/points/history")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["points"] == 50
    assert data[0]["reason"] == "event_attendance"


@pytest.mark.anyio
async def test_redeem_points_insufficient_balance(member_client: AsyncClient, mock_user: MockUser, mock_db_session):
    """POST /members/me/points/redeem with insufficient balance returns 400."""
    from unittest.mock import AsyncMock, MagicMock

    mock_user.loyalty_points = 50

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_user
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await member_client.post(
        f"{settings.API_V1_STR}/members/me/points/redeem",
        json={"amount": 999, "reason": "redemption"},
    )

    assert response.status_code == 400


# ── Phase 6A: GET /me/digest ──────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_weekly_digest_returns_structure(member_client: AsyncClient, mock_user: MockUser):
    """GET /members/me/digest returns top_suggestions, next_steps and generated_at."""
    from datetime import datetime, UTC

    fake_digest = {
        "top_suggestions": [
            {
                "member_id": str(uuid4()),
                "full_name": "Jane Doe",
                "tier": "gold",
                "company_name": "Acme",
                "industry": "software",
                "shared_segments": ["Tech & Founders"],
                "shared_events_count": 1,
                "score": 3.5,
                "reason_text": "Shares Tech & Founders · In venue now",
                "is_in_venue": True,
            }
        ],
        "next_steps": ["Tap NFC cards at the venue to instantly connect with matched members."],
        "generated_at": datetime.now(UTC),
    }

    with patch(
        "app.services.matching.MatchingEngine.get_weekly_digest",
        AsyncMock(return_value=fake_digest),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/digest")

    assert response.status_code == 200
    data = response.json()
    assert "top_suggestions" in data
    assert "next_steps" in data
    assert "generated_at" in data
    assert len(data["top_suggestions"]) == 1
    assert data["top_suggestions"][0]["full_name"] == "Jane Doe"


@pytest.mark.anyio
async def test_get_weekly_digest_empty_when_no_segments(member_client: AsyncClient, mock_user: MockUser):
    """When user has no segments, digest returns empty suggestions with a helpful next_step."""
    mock_user.segment_groups = []

    from datetime import datetime, UTC

    fake_digest = {
        "top_suggestions": [],
        "next_steps": ["Update your interests so the matching engine can find ideal connections."],
        "generated_at": datetime.now(UTC),
    }

    with patch(
        "app.services.matching.MatchingEngine.get_weekly_digest",
        AsyncMock(return_value=fake_digest),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/digest")

    assert response.status_code == 200
    data = response.json()
    assert data["top_suggestions"] == []
    assert len(data["next_steps"]) >= 1


# ── Phase 6D: GET /me/connection-gaps ────────────────────────────────────────


@pytest.mark.anyio
async def test_get_connection_gaps_returns_structure(member_client: AsyncClient):
    """GET /members/me/connection-gaps returns all required keys."""
    fake_gaps = {
        "user_segments": ["Tech & Founders"],
        "connected_segments": {"Finance & Investors": 1},
        "missing_or_weak_segments": ["Tech & Founders"],
        "priority_suggestions": [],
    }

    with patch(
        "app.services.matching.MatchingEngine.get_connection_gap_analysis",
        AsyncMock(return_value=fake_gaps),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/connection-gaps")

    assert response.status_code == 200
    data = response.json()
    assert "user_segments" in data
    assert "connected_segments" in data
    assert "missing_or_weak_segments" in data
    assert "priority_suggestions" in data


@pytest.mark.anyio
async def test_get_connection_gaps_empty_for_no_segments(member_client: AsyncClient, mock_user: MockUser):
    """Member with no segments gets an empty gap analysis."""
    mock_user.segment_groups = []

    empty_gaps = {
        "user_segments": [],
        "connected_segments": {},
        "missing_or_weak_segments": [],
        "priority_suggestions": [],
    }

    with patch(
        "app.services.matching.MatchingEngine.get_connection_gap_analysis",
        AsyncMock(return_value=empty_gaps),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/connection-gaps")

    assert response.status_code == 200
    data = response.json()
    assert data["missing_or_weak_segments"] == []


# ── Phase 6C: GET /me/engagement-health ──────────────────────────────────────


@pytest.mark.anyio
async def test_get_engagement_health_healthy(member_client: AsyncClient):
    """Active members get risk_level=healthy and an encouraging tip."""
    score_data = {
        "score": 5,
        "risk_level": "healthy",
        "factors": [],
        "recommendation": "Member is active.",
    }

    with patch(
        "app.services.churn.ChurnPredictionEngine.get_churn_score",
        AsyncMock(return_value=score_data),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/engagement-health")

    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "healthy"
    assert "tips" in data
    assert len(data["tips"]) >= 1
    # Score must NOT be exposed to the member
    assert "score" not in data


@pytest.mark.anyio
async def test_get_engagement_health_high_risk(member_client: AsyncClient):
    """High-risk members get urgent tips to return."""
    score_data = {
        "score": 75,
        "risk_level": "high",
        "factors": [],
        "recommendation": "Priority: reach out personally.",
    }

    with patch(
        "app.services.churn.ChurnPredictionEngine.get_churn_score",
        AsyncMock(return_value=score_data),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/engagement-health")

    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "high"
    # high/critical should surface more tips
    assert len(data["tips"]) >= 2


@pytest.mark.anyio
async def test_get_engagement_health_does_not_expose_score(member_client: AsyncClient):
    """The numeric churn score must never appear in the member-facing response."""
    score_data = {
        "score": 88,
        "risk_level": "critical",
        "factors": [],
        "recommendation": "Urgent.",
    }

    with patch(
        "app.services.churn.ChurnPredictionEngine.get_churn_score",
        AsyncMock(return_value=score_data),
    ):
        response = await member_client.get(f"{settings.API_V1_STR}/members/me/engagement-health")

    assert response.status_code == 200
    data = response.json()
    assert "score" not in data
    assert "factors" not in data
