"""Tests for admin routes (/api/v1/admin/*)."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session, get_user_service
from app.api.routes.v1.admin import get_admin_service, get_event_service
from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.main import app
from app.schemas.event import EventRead
from app.schemas.user import UserRead


class MockAdminUser:
    """Mock admin user for admin route tests."""

    def __init__(self, id=None, email="admin@thereddoor.club"):
        self.id = id or uuid4()
        self.email = email
        self.role = "admin"
        self.full_name = "Admin User"
        self.is_active = True
        self.is_superuser = True
        self.tier = "obsidian"
        self.segment_groups = []
        self.user_type = "member"
        self.hashed_password = "hashed"
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)

    def has_role(self, required_role) -> bool:
        # Admin has all roles
        return True


def _make_event(**kwargs) -> EventRead:
    now = datetime.now(UTC)
    defaults = dict(
        id=uuid4(),
        title="Admin Event",
        description=None,
        event_type="mixer",
        target_segments=[],
        capacity=50,
        ticket_price=Decimal("0.00"),
        starts_at=now,
        ends_at=None,
        status="draft",
        min_tier=None,
        rsvp_count=0,
        is_rsvped=False,
        match_score=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(kwargs)
    return EventRead(**defaults)


def _make_user_read(**kwargs) -> UserRead:
    now = datetime.now(UTC)
    defaults = dict(
        id=uuid4(),
        email="alice@example.com",
        phone=None,
        full_name="Alice Chen",
        company_name=None,
        industry=None,
        revenue_range=None,
        interests=[],
        user_type="member",
        tier="gold",
        segment_groups=[],
        pdpa_consent=True,
        last_seen_at=None,
        is_active=True,
        is_superuser=False,
        role="user",
        staff_notes=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(kwargs)
    return UserRead(**defaults)


@pytest.fixture
def mock_admin_user() -> MockAdminUser:
    return MockAdminUser()


@pytest.fixture
def mock_user_service() -> MagicMock:
    service = MagicMock()
    service.update = AsyncMock(return_value=_make_user_read())
    return service


@pytest.fixture
def mock_admin_service() -> MagicMock:
    service = MagicMock()
    service.get_floor_view = AsyncMock(return_value=[])
    service.get_analytics = AsyncMock(
        return_value={
            "total_members": 42,
            "total_prospects": 10,
            "active_today": 5,
            "events_this_week": 3,
        }
    )
    service.get_prep_checklist = AsyncMock(return_value=[])
    service.complete_checklist_item = AsyncMock(return_value={"id": str(uuid4()), "status": "completed"})
    # Phase 3
    service.list_service_requests = AsyncMock(return_value=[])
    service.update_service_request = AsyncMock(return_value={"id": str(uuid4()), "status": "acknowledged"})
    service.get_member_detail = AsyncMock(return_value={})
    service.update_member_notes = AsyncMock(return_value={"id": str(uuid4()), "staff_notes": None})
    service.get_revenue_summary = AsyncMock(
        return_value={"today": "0.00", "this_week": "0.00", "this_month": "0.00", "top_spenders": []}
    )
    service.list_activity = AsyncMock(return_value=[])
    return service


@pytest.fixture
def mock_event_service(mock_admin_user: MockAdminUser) -> MagicMock:
    service = MagicMock()
    service.list_events = AsyncMock(return_value=[])
    service.create_event = AsyncMock(return_value=_make_event(title="New Event", status="draft"))
    service.update_event = AsyncMock(return_value=_make_event(title="Updated Event"))
    return service


@pytest.fixture
async def admin_client(
    mock_admin_user: MockAdminUser,
    mock_admin_service: MagicMock,
    mock_event_service: MagicMock,
    mock_user_service: MagicMock,
    mock_redis,
    mock_db_session,
) -> AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: mock_admin_user
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service
    app.dependency_overrides[get_event_service] = lambda: mock_event_service
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    # Mock DB execute for list_members query
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.scalar = AsyncMock(return_value=0)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Members list ──────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_members_empty(admin_client: AsyncClient, mock_db_session):
    """GET /admin/members returns empty list when no members."""
    response = await admin_client.get(f"{settings.API_V1_STR}/admin/members")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_members_with_data(admin_client: AsyncClient, mock_db_session):
    """GET /admin/members returns serialised member list."""
    mock_member = MockAdminUser()
    mock_member.company_name = "Acme Corp"
    mock_member.industry = "Finance"
    mock_member.tier = "gold"
    mock_member.phone = None
    mock_member.revenue_range = None
    mock_member.interests = []
    mock_member.segment_groups = ["Finance & Investors"]
    mock_member.pdpa_consent = True
    mock_member.last_seen_at = None
    mock_member.user_type = "member"

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_member]
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/members")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["email"] == mock_member.email


# ── Floor view ────────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_floor_view_empty(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/floor returns empty list when venue is empty."""
    mock_admin_service.get_floor_view.return_value = []

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/floor")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_get_floor_view_with_members(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/floor returns members currently in venue."""
    entry_time = datetime.now(UTC).isoformat()
    mock_admin_service.get_floor_view.return_value = [
        {
            "member_id": str(uuid4()),
            "full_name": "John Doe",
            "company_name": "Finance Co.",
            "tier": "gold",
            "entry_time": entry_time,
            "location": "entrance",
        }
    ]

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/floor")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["full_name"] == "John Doe"


# ── Prep checklist ────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_prep_checklist_empty(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/prep-checklist returns empty list when no tasks."""
    mock_admin_service.get_prep_checklist.return_value = []

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/prep-checklist")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_complete_checklist_item(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """PATCH /admin/prep-checklist/{id} marks item as complete."""
    request_id = uuid4()
    mock_admin_service.complete_checklist_item.return_value = {
        "id": str(request_id),
        "status": "completed",
    }

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/prep-checklist/{request_id}"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    mock_admin_service.complete_checklist_item.assert_called_once_with(request_id)


@pytest.mark.anyio
async def test_complete_checklist_item_not_found(
    admin_client: AsyncClient, mock_admin_service: MagicMock
):
    """PATCH /admin/prep-checklist/{id} returns 404 when item doesn't exist."""
    mock_admin_service.complete_checklist_item.side_effect = NotFoundError(
        message="Service request not found"
    )

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/prep-checklist/{uuid4()}"
    )

    assert response.status_code == 404


# ── Analytics ─────────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_analytics(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/analytics/overview returns KPI data."""
    response = await admin_client.get(f"{settings.API_V1_STR}/admin/analytics/overview")

    assert response.status_code == 200
    data = response.json()
    assert data["total_members"] == 42
    assert data["active_today"] == 5
    assert data["events_this_week"] == 3


# ── Events management ─────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_all_events_admin(admin_client: AsyncClient, mock_event_service: MagicMock):
    """GET /admin/events returns all events (including drafts)."""
    events = [_make_event(title="Draft Event", status="draft")]
    mock_event_service.list_events.return_value = events

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/events")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Draft Event"
    # Verify include_all=True was passed
    call_kwargs = mock_event_service.list_events.call_args[1]
    assert call_kwargs["include_all"] is True


@pytest.mark.anyio
async def test_create_event(admin_client: AsyncClient, mock_event_service: MagicMock):
    """POST /admin/events creates a new event and returns 201."""
    new_event = _make_event(title="Exclusive Dinner", status="draft")
    mock_event_service.create_event.return_value = new_event
    starts_at = datetime.now(UTC).isoformat()

    response = await admin_client.post(
        f"{settings.API_V1_STR}/admin/events",
        json={
            "title": "Exclusive Dinner",
            "event_type": "dinner",
            "starts_at": starts_at,
            "capacity": 20,
            "ticket_price": "5000.00",
            "target_segments": ["Corporate Executives"],
            "status": "draft",
        },
    )

    assert response.status_code == 201
    mock_event_service.create_event.assert_called_once()


@pytest.mark.anyio
async def test_update_event(admin_client: AsyncClient, mock_event_service: MagicMock):
    """PATCH /admin/events/{id} updates and returns the event."""
    event_id = uuid4()
    updated = _make_event(id=event_id, title="Updated Title", status="published")
    mock_event_service.update_event.return_value = updated

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/events/{event_id}",
        json={"title": "Updated Title", "status": "published"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["status"] == "published"


# ── Admin lockers ─────────────────────────────────────────────────────────────


def _make_locker(**kwargs):
    from app.schemas.locker import LockerRead
    defaults = dict(
        id=uuid4(),
        locker_number="A01",
        location="main_floor",
        status="available",
        assigned_member_id=None,
        assigned_at=None,
        released_at=None,
    )
    defaults.update(kwargs)
    return LockerRead(**defaults)


@pytest.mark.anyio
async def test_list_lockers_empty(admin_client: AsyncClient):
    """GET /admin/lockers returns empty list when no lockers."""
    with patch("app.repositories.locker.list_all", AsyncMock(return_value=[])):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/lockers")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_lockers_with_data(admin_client: AsyncClient):
    """GET /admin/lockers returns list of lockers."""
    locker = _make_locker(locker_number="A01", status="available")

    with patch("app.repositories.locker.list_all", AsyncMock(return_value=[locker])):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/lockers")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["locker_number"] == "A01"
    assert data[0]["status"] == "available"


@pytest.mark.anyio
async def test_create_locker(admin_client: AsyncClient):
    """POST /admin/lockers creates and returns a new locker."""
    new_locker = _make_locker(locker_number="B02", location="vip_room")

    with patch("app.repositories.locker.create", AsyncMock(return_value=new_locker)):
        response = await admin_client.post(
            f"{settings.API_V1_STR}/admin/lockers",
            json={"locker_number": "B02", "location": "vip_room"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["locker_number"] == "B02"
    assert data["location"] == "vip_room"


@pytest.mark.anyio
async def test_force_release_locker(admin_client: AsyncClient):
    """DELETE /admin/lockers/{number}/release force-releases an occupied locker."""
    occupied = _make_locker(locker_number="A01", status="occupied", assigned_member_id=uuid4())
    released = _make_locker(locker_number="A01", status="available")

    with (
        patch("app.repositories.locker.get_by_number", AsyncMock(return_value=occupied)),
        patch("app.repositories.locker.release", AsyncMock(return_value=released)),
    ):
        response = await admin_client.delete(
            f"{settings.API_V1_STR}/admin/lockers/A01/release"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["locker_number"] == "A01"
    assert data["status"] == "available"


@pytest.mark.anyio
async def test_force_release_locker_not_found(admin_client: AsyncClient):
    """DELETE /admin/lockers/{number}/release returns 404 when locker doesn't exist."""
    with patch("app.repositories.locker.get_by_number", AsyncMock(return_value=None)):
        response = await admin_client.delete(
            f"{settings.API_V1_STR}/admin/lockers/Z99/release"
        )

    assert response.status_code == 404


# ── Admin tabs ────────────────────────────────────────────────────────────────


def _make_tab(**kwargs):
    from app.schemas.tab import TabRead
    defaults = dict(
        id=uuid4(),
        member_id=uuid4(),
        status="open",
        opened_at=datetime.now(UTC),
        closed_at=None,
        total_amount=Decimal("0.00"),
        items=[],
    )
    defaults.update(kwargs)
    return TabRead(**defaults)


@pytest.mark.anyio
async def test_list_open_tabs_empty(admin_client: AsyncClient):
    """GET /admin/tabs returns empty list when no open tabs."""
    with patch("app.repositories.tab.list_open_tabs", AsyncMock(return_value=[])):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/tabs")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_open_tabs_with_data(admin_client: AsyncClient):
    """GET /admin/tabs returns list of open tabs."""
    tab = _make_tab(total_amount=Decimal("500.00"))

    with patch("app.repositories.tab.list_open_tabs", AsyncMock(return_value=[tab])):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/tabs")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "open"
    assert float(data[0]["total_amount"]) == 500.0


@pytest.mark.anyio
async def test_close_tab(admin_client: AsyncClient):
    """POST /admin/tabs/{id}/close closes an open tab."""
    tab_id = uuid4()
    open_tab = _make_tab(id=tab_id, total_amount=Decimal("750.00"))
    closed_tab = _make_tab(id=tab_id, status="closed", total_amount=Decimal("750.00"))

    with (
        patch("app.repositories.tab.get_tab_by_id", AsyncMock(return_value=open_tab)),
        patch("app.repositories.tab.close_tab", AsyncMock(return_value=closed_tab)),
    ):
        response = await admin_client.post(
            f"{settings.API_V1_STR}/admin/tabs/{tab_id}/close"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "closed"


@pytest.mark.anyio
async def test_close_tab_not_found(admin_client: AsyncClient):
    """POST /admin/tabs/{id}/close returns 404 when tab doesn't exist."""
    with patch("app.repositories.tab.get_tab_by_id", AsyncMock(return_value=None)):
        response = await admin_client.post(
            f"{settings.API_V1_STR}/admin/tabs/{uuid4()}/close"
        )

    assert response.status_code == 404


# ── Phase 3: Services (concierge operations) ──────────────────────────────────


@pytest.mark.anyio
async def test_list_service_requests_empty(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/services returns empty list when no requests."""
    mock_admin_service.list_service_requests.return_value = []

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/services")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_service_requests_with_data(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/services returns list of service requests with member names."""
    req_id = uuid4()
    mock_admin_service.list_service_requests.return_value = [
        {
            "id": str(req_id),
            "member_id": str(uuid4()),
            "member_name": "Alice Chen",
            "request_type": "bar",
            "status": "pending",
            "details": {"notes": "Whisky please"},
            "assigned_to": None,
            "assigned_to_name": None,
            "created_at": datetime.now(UTC).isoformat(),
            "completed_at": None,
            "member_rating": None,
        }
    ]

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/services")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["member_name"] == "Alice Chen"
    assert data[0]["request_type"] == "bar"
    assert data[0]["status"] == "pending"


@pytest.mark.anyio
async def test_list_service_requests_with_status_filter(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/services?status=pending passes filter to service."""
    mock_admin_service.list_service_requests.return_value = []

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/services?status=pending")

    assert response.status_code == 200
    mock_admin_service.list_service_requests.assert_called_once_with("pending", None, 0, 50)


@pytest.mark.anyio
async def test_update_service_request(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """PATCH /admin/services/{id} updates status."""
    req_id = uuid4()
    mock_admin_service.update_service_request.return_value = {
        "id": str(req_id),
        "status": "in_progress",
        "member_id": str(uuid4()),
        "request_type": "bar",
        "details": None,
        "assigned_to": None,
        "created_at": datetime.now(UTC).isoformat(),
        "completed_at": None,
        "member_rating": None,
    }

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/services/{req_id}",
        json={"status": "in_progress"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_progress"


# ── Phase 3: Member detail (CRM) ──────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_member_detail(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/members/{id} returns member detail with engagement stats."""
    member_id = uuid4()
    mock_admin_service.get_member_detail.return_value = {
        "id": str(member_id),
        "email": "alice@example.com",
        "full_name": "Alice Chen",
        "tier": "gold",
        "user_type": "member",
        "role": "user",
        "is_active": True,
        "staff_notes": "VIP guest",
        "connections_count": 5,
        "tab_total": 1500.0,
        "service_requests_count": 3,
        "recent_taps": [],
    }

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/members/{member_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Alice Chen"
    assert data["connections_count"] == 5
    assert data["staff_notes"] == "VIP guest"


@pytest.mark.anyio
async def test_get_member_detail_not_found(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/members/{id} returns 404 when member doesn't exist."""
    mock_admin_service.get_member_detail.side_effect = NotFoundError(message="Member not found")

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/members/{uuid4()}")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_update_member_notes(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """PATCH /admin/members/{id}/notes updates staff notes."""
    member_id = uuid4()
    mock_admin_service.update_member_notes.return_value = {
        "id": str(member_id),
        "staff_notes": "Prefers corner table",
    }

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/members/{member_id}/notes",
        json={"notes": "Prefers corner table"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["staff_notes"] == "Prefers corner table"


# ── Phase 3: Revenue analytics ────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_revenue_analytics(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/analytics/revenue returns revenue summary."""
    mock_admin_service.get_revenue_summary.return_value = {
        "today": "1500.00",
        "this_week": "8000.00",
        "this_month": "32000.00",
        "top_spenders": [
            {"member_id": str(uuid4()), "full_name": "Bob Lee", "total_spent": "5000.00"}
        ],
    }

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/analytics/revenue")

    assert response.status_code == 200
    data = response.json()
    assert data["today"] == "1500.00"
    assert data["this_month"] == "32000.00"
    assert len(data["top_spenders"]) == 1
    assert data["top_spenders"][0]["full_name"] == "Bob Lee"


# ── Phase 3: Activity log ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_activity_empty(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/activity returns empty list when no events."""
    mock_admin_service.list_activity.return_value = []

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/activity")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_activity_with_data(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/activity returns tap events with member names."""
    mock_admin_service.list_activity.return_value = [
        {
            "id": str(uuid4()),
            "member_id": str(uuid4()),
            "member_name": "Alice Chen",
            "card_id": "RD-NFC-001",
            "tap_type": "venue_entry",
            "reader_id": "READER-01",
            "location": "main_entrance",
            "tapped_at": datetime.now(UTC).isoformat(),
            "metadata": None,
        }
    ]

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/activity")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["member_name"] == "Alice Chen"
    assert data[0]["tap_type"] == "venue_entry"


@pytest.mark.anyio
async def test_list_activity_with_tap_type_filter(admin_client: AsyncClient, mock_admin_service: MagicMock):
    """GET /admin/activity?tap_type=payment_tap passes filter to service."""
    mock_admin_service.list_activity.return_value = []

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/activity?tap_type=payment_tap")

    assert response.status_code == 200
    mock_admin_service.list_activity.assert_called_once_with("payment_tap", 0, 25)


# ── Phase 5A: Loyalty leaderboard & award ────────────────────────────────────


@pytest.mark.anyio
async def test_get_loyalty_leaderboard_empty(admin_client: AsyncClient, mock_db_session):
    """GET /admin/loyalty/leaderboard returns empty list when no members have points."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/loyalty/leaderboard")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_get_loyalty_leaderboard_with_data(admin_client: AsyncClient, mock_db_session):
    """GET /admin/loyalty/leaderboard returns ranked entries."""
    member = MagicMock()
    member.id = uuid4()
    member.full_name = "Top Member"
    member.company_name = "TechCo"
    member.tier = "gold"
    member.loyalty_lifetime_points = 500
    member.loyalty_points = 200

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [member]
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/loyalty/leaderboard")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["rank"] == 1
    assert data[0]["full_name"] == "Top Member"
    assert data[0]["lifetime_points"] == 500


@pytest.mark.anyio
async def test_admin_award_points_success(admin_client: AsyncClient, mock_db_session):
    """POST /admin/loyalty/award creates a loyalty transaction and returns it."""
    member_id = uuid4()

    mock_tx = MagicMock()
    mock_tx.id = uuid4()
    mock_tx.member_id = member_id
    mock_tx.points = 100
    mock_tx.reason = "manual_award"
    mock_tx.reference_id = None
    mock_tx.created_at = datetime.now(UTC)

    with patch("app.services.loyalty.LoyaltyTransaction", return_value=mock_tx):
        response = await admin_client.post(
            f"{settings.API_V1_STR}/admin/loyalty/award",
            json={"member_id": str(member_id), "amount": 100},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["points"] == 100
    assert data["reason"] == "manual_award"


@pytest.mark.anyio
async def test_admin_award_points_missing_fields(admin_client: AsyncClient):
    """POST /admin/loyalty/award with missing fields returns 422."""
    response = await admin_client.post(
        f"{settings.API_V1_STR}/admin/loyalty/award",
        json={"amount": 50},  # missing member_id
    )

    assert response.status_code == 422


# ── Phase 5D: Analytics v2 ────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_loyalty_analytics(admin_client: AsyncClient, mock_db_session):
    """GET /admin/analytics/loyalty returns loyalty KPIs."""
    # scalar calls: earned, redeemed, avg_balance
    mock_db_session.scalar = AsyncMock(side_effect=[500, -100, 150.5])

    # execute call for tier distribution
    mock_tier_result = MagicMock()
    mock_tier_result.all.return_value = [("gold", 5), ("silver", 3)]
    mock_db_session.execute = AsyncMock(return_value=mock_tier_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/analytics/loyalty")

    assert response.status_code == 200
    data = response.json()
    assert "points_earned_total" in data
    assert "points_redeemed_total" in data
    assert "avg_balance" in data
    assert "tier_distribution" in data


@pytest.mark.anyio
async def test_get_promoter_analytics(admin_client: AsyncClient, mock_db_session):
    """GET /admin/analytics/promoters returns promoter KPIs."""
    mock_db_session.scalar = AsyncMock(side_effect=[3, 15, Decimal("7500.00")])

    mock_top_result = MagicMock()
    mock_top_result.first.return_value = None
    mock_db_session.execute = AsyncMock(return_value=mock_top_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/analytics/promoters")

    assert response.status_code == 200
    data = response.json()
    assert "active_codes" in data
    assert "total_conversions" in data
    assert "total_attributed_revenue" in data
    assert "top_promoter" in data


@pytest.mark.anyio
async def test_get_corporate_analytics(admin_client: AsyncClient, mock_db_session):
    """GET /admin/analytics/corporate returns corporate KPIs."""
    mock_db_session.scalar = AsyncMock(return_value=2)

    mock_totals_result = MagicMock()
    mock_totals_result.first.return_value = (50, 35, Decimal("480000.00"))
    mock_db_session.execute = AsyncMock(return_value=mock_totals_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/admin/analytics/corporate")

    assert response.status_code == 200
    data = response.json()
    assert "active_accounts" in data
    assert "total_seats" in data
    assert "utilized_seats" in data
    assert "seat_utilization_pct" in data


# ── Phase 6A: GET /admin/matching/deal-flow ───────────────────────────────────


@pytest.mark.anyio
async def test_get_deal_flow_pairs_empty(admin_client: AsyncClient):
    """GET /admin/matching/deal-flow returns empty list when no pairs found."""
    with patch(
        "app.services.matching.MatchingEngine.get_deal_flow_pairs",
        AsyncMock(return_value=[]),
    ):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/matching/deal-flow")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_get_deal_flow_pairs_returns_pairs(admin_client: AsyncClient):
    """GET /admin/matching/deal-flow returns buyer-seller pair data."""
    from uuid import uuid4

    fake_pairs = [
        {
            "buyer": {
                "member_id": str(uuid4()),
                "full_name": "Finance Guy",
                "company_name": "VC Fund",
                "industry": "finance",
                "tier": "platinum",
                "segments": ["Finance & Investors"],
            },
            "seller": {
                "member_id": str(uuid4()),
                "full_name": "Tech Founder",
                "company_name": "StartupCo",
                "industry": "tech",
                "tier": "gold",
                "segments": ["Tech & Founders"],
            },
            "mutual_connections": 2,
            "score": 1.6,
        }
    ]

    with patch(
        "app.services.matching.MatchingEngine.get_deal_flow_pairs",
        AsyncMock(return_value=fake_pairs),
    ):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/matching/deal-flow")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["buyer"]["full_name"] == "Finance Guy"
    assert data[0]["seller"]["full_name"] == "Tech Founder"
    assert data[0]["score"] == 1.6


# ── Phase 6B: GET /admin/analytics/forecast/{event_id} ───────────────────────


@pytest.mark.anyio
async def test_forecast_event_not_found(admin_client: AsyncClient, mock_db_session):
    """GET /admin/analytics/forecast/{id} returns 404 when event missing."""
    from uuid import uuid4

    mock_db_session.get = AsyncMock(return_value=None)

    response = await admin_client.get(
        f"{settings.API_V1_STR}/admin/analytics/forecast/{uuid4()}"
    )

    assert response.status_code == 404


@pytest.mark.anyio
async def test_forecast_event_returns_prediction(admin_client: AsyncClient, mock_db_session):
    """GET /admin/analytics/forecast/{id} returns attendance prediction."""
    from uuid import uuid4

    event_id = uuid4()
    mock_event = MagicMock()
    mock_event.id = event_id
    mock_db_session.get = AsyncMock(return_value=mock_event)

    fake_forecast = {
        "event_id": event_id,
        "event_title": "Finance Summit",
        "predicted_attendees": 75,
        "actual_capacity": 100,
        "capacity_utilization_pct": 75.0,
        "confidence": "medium",
        "similar_events_count": 3,
        "recommendation": "Good fill rate expected.",
    }

    with patch(
        "app.services.forecasting.ForecastingEngine.predict_event_attendance",
        AsyncMock(return_value=fake_forecast),
    ):
        response = await admin_client.get(
            f"{settings.API_V1_STR}/admin/analytics/forecast/{event_id}"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["predicted_attendees"] == 75
    assert data["confidence"] == "medium"


# ── Phase 6B: GET /admin/analytics/peak-hours ─────────────────────────────────


@pytest.mark.anyio
async def test_get_peak_hours_returns_heatmap(admin_client: AsyncClient):
    """GET /admin/analytics/peak-hours returns a 7×24 heatmap structure."""
    fake_peak_hours = {
        "heatmap": [[0] * 24 for _ in range(7)],
        "busiest_slot": {"weekday_name": "Saturday", "hour": 21, "count": 45},
        "quietest_slot": {"weekday_name": "Monday", "hour": 6, "count": 1},
    }

    with patch(
        "app.services.forecasting.ForecastingEngine.get_peak_hours",
        AsyncMock(return_value=fake_peak_hours),
    ):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/analytics/peak-hours")

    assert response.status_code == 200
    data = response.json()
    assert "heatmap" in data
    assert len(data["heatmap"]) == 7
    assert data["busiest_slot"]["weekday_name"] == "Saturday"


# ── Phase 6B: GET /admin/analytics/segment-demand ────────────────────────────


@pytest.mark.anyio
async def test_get_segment_demand_returns_list(admin_client: AsyncClient):
    """GET /admin/analytics/segment-demand returns per-segment stats."""
    fake_demand = [
        {"segment": "Tech & Founders", "event_count": 5, "avg_fill_rate": 0.82, "trending_up": True},
        {"segment": "Finance & Investors", "event_count": 3, "avg_fill_rate": 0.65, "trending_up": False},
    ]

    with patch(
        "app.services.forecasting.ForecastingEngine.get_segment_demand",
        AsyncMock(return_value=fake_demand),
    ):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/analytics/segment-demand")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["segment"] == "Tech & Founders"
    assert data[0]["trending_up"] is True


# ── Phase 6C: GET /admin/analytics/churn ─────────────────────────────────────


@pytest.mark.anyio
async def test_get_churn_overview_returns_structure(admin_client: AsyncClient):
    """GET /admin/analytics/churn returns retention metrics."""
    fake_overview = {
        "retention_rate_30d": 82.5,
        "avg_churn_score": 22.0,
        "total_members": 40,
        "active_30d": 33,
        "risk_distribution": {"healthy": 25, "low": 8, "medium": 5, "high": 2, "critical": 0},
        "at_risk_members": [],
    }

    with patch(
        "app.services.churn.ChurnPredictionEngine.get_retention_overview",
        AsyncMock(return_value=fake_overview),
    ):
        response = await admin_client.get(f"{settings.API_V1_STR}/admin/analytics/churn")

    assert response.status_code == 200
    data = response.json()
    assert data["retention_rate_30d"] == 82.5
    assert data["total_members"] == 40
    assert "risk_distribution" in data
    assert "at_risk_members" in data


# ── Phase 6C: GET /admin/analytics/churn/{member_id} ─────────────────────────


@pytest.mark.anyio
async def test_get_member_churn_not_found(admin_client: AsyncClient, mock_db_session):
    """GET /admin/analytics/churn/{id} returns 404 when member missing."""
    from uuid import uuid4

    mock_db_session.get = AsyncMock(return_value=None)

    response = await admin_client.get(
        f"{settings.API_V1_STR}/admin/analytics/churn/{uuid4()}"
    )

    assert response.status_code == 404


@pytest.mark.anyio
async def test_get_member_churn_returns_score(admin_client: AsyncClient, mock_db_session):
    """GET /admin/analytics/churn/{id} returns detailed churn score breakdown."""
    from uuid import uuid4

    member_id = uuid4()
    mock_member = MagicMock()
    mock_member.id = member_id
    mock_db_session.get = AsyncMock(return_value=mock_member)

    fake_score = {
        "score": 55,
        "risk_level": "medium",
        "factors": [
            {"name": "days_since_last_seen", "impact": 30, "detail": "Last seen 45d ago"},
            {"name": "tap_frequency_decline", "impact": 0, "detail": "Stable"},
            {"name": "loyalty_earning", "impact": 10, "detail": "No points in 30d"},
            {"name": "event_rsvp_activity", "impact": 10, "detail": "No RSVPs in 60d"},
            {"name": "spending_activity", "impact": 5, "detail": "No spending"},
        ],
        "recommendation": "Send a re-engagement message.",
    }

    with patch(
        "app.services.churn.ChurnPredictionEngine.get_churn_score",
        AsyncMock(return_value=fake_score),
    ):
        response = await admin_client.get(
            f"{settings.API_V1_STR}/admin/analytics/churn/{member_id}"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 55
    assert data["risk_level"] == "medium"
    assert len(data["factors"]) == 5


# ── PATCH /admin/members/{id} — update member profile ────────────────────────


@pytest.mark.anyio
async def test_update_member_full_name(admin_client: AsyncClient, mock_user_service: MagicMock):
    """PATCH /admin/members/{id} updates member's full_name and returns UserRead."""
    member_id = uuid4()
    mock_user_service.update.return_value = _make_user_read(id=member_id, full_name="Alice Updated")

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/members/{member_id}",
        json={"full_name": "Alice Updated"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Alice Updated"
    mock_user_service.update.assert_called_once()
    call_args = mock_user_service.update.call_args
    assert call_args[0][0] == member_id


@pytest.mark.anyio
async def test_update_member_tier(admin_client: AsyncClient, mock_user_service: MagicMock):
    """PATCH /admin/members/{id} can update member tier."""
    member_id = uuid4()
    mock_user_service.update.return_value = _make_user_read(id=member_id, tier="obsidian")

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/members/{member_id}",
        json={"tier": "obsidian"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["tier"] == "obsidian"


@pytest.mark.anyio
async def test_update_member_user_type(admin_client: AsyncClient, mock_user_service: MagicMock):
    """PATCH /admin/members/{id} can update user_type from prospect to member."""
    member_id = uuid4()
    mock_user_service.update.return_value = _make_user_read(id=member_id, user_type="member")

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/members/{member_id}",
        json={"user_type": "member"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["user_type"] == "member"


@pytest.mark.anyio
async def test_update_member_deactivate(admin_client: AsyncClient, mock_user_service: MagicMock):
    """PATCH /admin/members/{id} can deactivate a member by setting is_active=False."""
    member_id = uuid4()
    mock_user_service.update.return_value = _make_user_read(id=member_id, is_active=False)

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/members/{member_id}",
        json={"is_active": False},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False


@pytest.mark.anyio
async def test_update_member_multiple_fields(admin_client: AsyncClient, mock_user_service: MagicMock):
    """PATCH /admin/members/{id} accepts and applies multiple field updates at once."""
    member_id = uuid4()
    mock_user_service.update.return_value = _make_user_read(
        id=member_id,
        full_name="Bob Smith",
        tier="gold",
        company_name="Smith & Co",
    )

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/admin/members/{member_id}",
        json={"full_name": "Bob Smith", "tier": "gold", "company_name": "Smith & Co"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Bob Smith"
    assert data["tier"] == "gold"
    assert data["company_name"] == "Smith & Co"
