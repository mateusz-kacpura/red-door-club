"""Tests for event routes."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session
from app.api.routes.v1.events import get_event_service
from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.main import app
from app.schemas.event import EventRead


class MockUser:
    """Mock regular member for event tests."""

    def __init__(self, id=None, email="member@example.com", role="user"):
        self.id = id or uuid4()
        self.email = email
        self.role = role
        self.full_name = "Test Member"
        self.is_active = True
        self.tier = "silver"
        self.segment_groups = ["Finance & Investors", "Tech & Founders"]
        self.created_at = datetime.now(UTC)

    def has_role(self, required_role) -> bool:
        if self.role == "admin":
            return True
        if hasattr(required_role, "value"):
            return self.role == required_role.value
        return self.role == required_role


def _make_event(**kwargs) -> EventRead:
    """Build a minimal valid EventRead instance."""
    now = datetime.now(UTC)
    defaults = dict(
        id=uuid4(),
        title="Test Event",
        description="A test event",
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
def mock_event_service() -> MagicMock:
    service = MagicMock()
    service.list_events = AsyncMock(return_value=[])
    service.get_event = AsyncMock()
    service.rsvp = AsyncMock(return_value=True)
    service.cancel_rsvp = AsyncMock(return_value=True)
    service.checkin = AsyncMock(return_value=True)
    return service


@pytest.fixture
def mock_user() -> MockUser:
    return MockUser()


@pytest.fixture
async def events_client(
    mock_event_service: MagicMock,
    mock_user: MockUser,
    mock_redis,
    mock_db_session,
) -> AsyncClient:
    app.dependency_overrides[get_event_service] = lambda: mock_event_service
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── List events ───────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_events_empty(events_client: AsyncClient, mock_event_service: MagicMock):
    """GET /events returns empty list when no events exist."""
    mock_event_service.list_events.return_value = []

    response = await events_client.get(f"{settings.API_V1_STR}/events")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_events_returns_match_score(events_client: AsyncClient, mock_event_service: MagicMock):
    """GET /events returns events with match_score field."""
    event = _make_event(title="Mixer Night", match_score=0.8, target_segments=["Finance & Investors"])
    mock_event_service.list_events.return_value = [event]

    response = await events_client.get(f"{settings.API_V1_STR}/events")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Mixer Night"
    assert data[0]["match_score"] == 0.8


@pytest.mark.anyio
async def test_list_events_pagination(events_client: AsyncClient, mock_event_service: MagicMock):
    """GET /events passes skip and limit to service."""
    mock_event_service.list_events.return_value = []

    await events_client.get(f"{settings.API_V1_STR}/events?skip=10&limit=5")

    call_kwargs = mock_event_service.list_events.call_args[1]
    assert call_kwargs["skip"] == 10
    assert call_kwargs["limit"] == 5


# ── Get single event ──────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_event_success(events_client: AsyncClient, mock_event_service: MagicMock):
    """GET /events/{id} returns event detail."""
    event_id = uuid4()
    event = _make_event(id=event_id, title="VIP Dinner", rsvp_count=12)
    mock_event_service.get_event.return_value = event

    response = await events_client.get(f"{settings.API_V1_STR}/events/{event_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "VIP Dinner"
    assert data["rsvp_count"] == 12


@pytest.mark.anyio
async def test_get_event_not_found(events_client: AsyncClient, mock_event_service: MagicMock):
    """GET /events/{id} returns 404 for non-existent event."""
    mock_event_service.get_event.side_effect = NotFoundError(message="Event not found")

    response = await events_client.get(f"{settings.API_V1_STR}/events/{uuid4()}")

    assert response.status_code == 404


# ── RSVP ─────────────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_rsvp_success(events_client: AsyncClient, mock_event_service: MagicMock):
    """POST /events/{id}/rsvp returns rsvped=True on success."""
    mock_event_service.rsvp.return_value = True
    event_id = uuid4()

    response = await events_client.post(f"{settings.API_V1_STR}/events/{event_id}/rsvp")

    assert response.status_code == 200
    data = response.json()
    assert data["rsvped"] is True
    assert "successful" in data["message"].lower()


@pytest.mark.anyio
async def test_rsvp_event_at_capacity(events_client: AsyncClient, mock_event_service: MagicMock):
    """POST /events/{id}/rsvp returns 400 when event is full."""
    mock_event_service.rsvp.side_effect = BadRequestError(message="Event is at full capacity.")

    response = await events_client.post(f"{settings.API_V1_STR}/events/{uuid4()}/rsvp")

    assert response.status_code == 400


@pytest.mark.anyio
async def test_rsvp_event_not_published(events_client: AsyncClient, mock_event_service: MagicMock):
    """POST /events/{id}/rsvp returns 400 when event is not published."""
    mock_event_service.rsvp.side_effect = BadRequestError(message="Cannot RSVP to this event.")

    response = await events_client.post(f"{settings.API_V1_STR}/events/{uuid4()}/rsvp")

    assert response.status_code == 400


@pytest.mark.anyio
async def test_rsvp_event_not_found(events_client: AsyncClient, mock_event_service: MagicMock):
    """POST /events/{id}/rsvp returns 404 for non-existent event."""
    mock_event_service.rsvp.side_effect = NotFoundError(message="Event not found")

    response = await events_client.post(f"{settings.API_V1_STR}/events/{uuid4()}/rsvp")

    assert response.status_code == 404


# ── Cancel RSVP ───────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_cancel_rsvp_success(events_client: AsyncClient, mock_event_service: MagicMock):
    """DELETE /events/{id}/rsvp cancels RSVP."""
    mock_event_service.cancel_rsvp.return_value = True
    event_id = uuid4()

    response = await events_client.delete(f"{settings.API_V1_STR}/events/{event_id}/rsvp")

    assert response.status_code == 200
    assert response.json()["cancelled"] is True


@pytest.mark.anyio
async def test_cancel_rsvp_not_found(events_client: AsyncClient, mock_event_service: MagicMock):
    """DELETE /events/{id}/rsvp returns 404 when event doesn't exist."""
    mock_event_service.cancel_rsvp.side_effect = NotFoundError(message="Event not found")

    response = await events_client.delete(f"{settings.API_V1_STR}/events/{uuid4()}/rsvp")

    assert response.status_code == 404
