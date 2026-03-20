"""Tests for staff routes (/api/v1/staff/*) and admin staff management."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session, get_redis
from app.main import app

from app.api.routes.v1.staff import get_staff_service


BANGKOK_TZ = ZoneInfo("Asia/Bangkok")


class MockUser:
    """Mock user for staff tests."""

    def __init__(self, id=None, role="staff", tier="gold", full_name="Staff User"):
        self.id = id or uuid4()
        self.email = "staff@example.com"
        self.role = role
        self.full_name = full_name
        self.company_name = "Red Door Club"
        self.industry = None
        self.tier = tier
        self.is_active = True
        self.is_promoter = False
        self.is_superuser = False
        self.user_type = "staff"
        self.hashed_password = "hashed"
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)

    def has_role(self, required_role) -> bool:
        from app.db.models.user import _ROLE_RANK
        role_val = required_role.value if hasattr(required_role, "value") else required_role
        return _ROLE_RANK.get(self.role, 0) >= _ROLE_RANK.get(role_val, 0)


class MockMember:
    """Mock member being checked in."""

    def __init__(self, id=None, tier="gold", full_name="Alice Smith", is_active=True):
        self.id = id or uuid4()
        self.email = "alice@example.com"
        self.role = "user"
        self.full_name = full_name
        self.company_name = "Acme Corp"
        self.industry = "Technology"
        self.tier = tier
        self.is_active = is_active
        self.user_type = "member"


class MockEvent:
    """Mock event for checkin."""

    def __init__(self, id=None, ticket_price=Decimal("500.00"), promo_tiers=None, status="published"):
        self.id = id or uuid4()
        self.title = "Friday Mixer"
        self.description = None
        self.event_type = "mixer"
        self.target_segments = []
        self.capacity = 50
        self.ticket_price = ticket_price
        self.starts_at = datetime.now(BANGKOK_TZ)
        self.ends_at = None
        self.status = status
        self.min_tier = None
        self.promo_tiers = promo_tiers or []
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)


class MockTapEvent:
    """Mock tap event."""

    def __init__(self, event_id=None, member_id=None):
        self.id = uuid4()
        self.card_id = None
        self.member_id = member_id or uuid4()
        self.tap_type = "qr_entry"
        self.metadata_ = {"event_id": str(event_id)} if event_id else {}
        self.tapped_at = datetime.now(UTC)


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def staff_user() -> MockUser:
    return MockUser(role="staff")


@pytest.fixture
def admin_user() -> MockUser:
    return MockUser(role="admin", full_name="Admin User")


@pytest.fixture
def regular_user() -> MockUser:
    return MockUser(role="user", full_name="Regular User")


@pytest.fixture
def mock_staff_service() -> MagicMock:
    service = MagicMock()
    service.get_member_for_checkin = AsyncMock()
    service.get_today_events = AsyncMock(return_value=[])
    service.checkin = AsyncMock()
    return service


@pytest.fixture
def mock_redis_client() -> MagicMock:
    from app.clients.redis import RedisClient
    mock = MagicMock(spec=RedisClient)
    mock.publish = AsyncMock(return_value=0)
    return mock


@pytest.fixture
async def staff_client(
    staff_user: MockUser,
    mock_staff_service: MagicMock,
    mock_redis_client: MagicMock,
    mock_db_session,
) -> AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: staff_user
    app.dependency_overrides[get_staff_service] = lambda: mock_staff_service
    app.dependency_overrides[get_db_session] = lambda: mock_db_session
    app.dependency_overrides[get_redis] = lambda: mock_redis_client

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def admin_client(
    admin_user: MockUser,
    mock_db_session,
    mock_redis_client: MagicMock,
) -> AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db_session] = lambda: mock_db_session
    app.dependency_overrides[get_redis] = lambda: mock_redis_client

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def user_client(
    regular_user: MockUser,
    mock_staff_service: MagicMock,
    mock_redis_client: MagicMock,
    mock_db_session,
) -> AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: regular_user
    app.dependency_overrides[get_staff_service] = lambda: mock_staff_service
    app.dependency_overrides[get_db_session] = lambda: mock_db_session
    app.dependency_overrides[get_redis] = lambda: mock_redis_client

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── GET /staff/member/{member_id} ───────────────────────────────────────────


@pytest.mark.anyio
async def test_get_member_info(staff_client: AsyncClient, mock_staff_service: MagicMock):
    member_id = uuid4()
    mock_staff_service.get_member_for_checkin.return_value = {
        "id": str(member_id),
        "full_name": "Alice Smith",
        "tier": "gold",
        "company_name": "Acme Corp",
        "is_active": True,
    }

    response = await staff_client.get(f"/api/v1/staff/member/{member_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Alice Smith"
    assert data["tier"] == "gold"
    mock_staff_service.get_member_for_checkin.assert_called_once_with(member_id)


@pytest.mark.anyio
async def test_get_member_not_found(staff_client: AsyncClient, mock_staff_service: MagicMock):
    from app.core.exceptions import NotFoundError
    member_id = uuid4()
    mock_staff_service.get_member_for_checkin.side_effect = NotFoundError(message="Member not found.")

    response = await staff_client.get(f"/api/v1/staff/member/{member_id}")

    assert response.status_code == 404
    assert "Member not found" in response.json()["error"]["message"]


# ── GET /staff/today-events ─────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_today_events(staff_client: AsyncClient, mock_staff_service: MagicMock):
    from app.schemas.event import EventRead

    event_id = uuid4()
    now = datetime.now(UTC)
    mock_staff_service.get_today_events.return_value = [
        EventRead(
            id=event_id,
            title="Friday Mixer",
            event_type="mixer",
            target_segments=[],
            capacity=50,
            ticket_price=Decimal("500.00"),
            starts_at=now,
            status="published",
            promo_tiers=["gold", "platinum"],
            created_at=now,
            updated_at=now,
        )
    ]

    response = await staff_client.get("/api/v1/staff/today-events")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Friday Mixer"
    assert data[0]["promo_tiers"] == ["gold", "platinum"]


@pytest.mark.anyio
async def test_get_today_events_empty(staff_client: AsyncClient, mock_staff_service: MagicMock):
    mock_staff_service.get_today_events.return_value = []

    response = await staff_client.get("/api/v1/staff/today-events")

    assert response.status_code == 200
    assert response.json() == []


# ── POST /staff/checkin ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_checkin_success(staff_client: AsyncClient, mock_staff_service: MagicMock):
    member_id = uuid4()
    event_id = uuid4()
    mock_staff_service.checkin.return_value = {
        "status": "checked_in",
        "member_name": "Alice Smith",
        "event_title": "Friday Mixer",
        "fee": "500.00",
        "is_promo": False,
    }

    response = await staff_client.post(
        "/api/v1/staff/checkin",
        json={"member_id": str(member_id), "event_id": str(event_id)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "checked_in"
    assert data["member_name"] == "Alice Smith"
    assert data["fee"] == "500.00"
    assert data["is_promo"] is False


@pytest.mark.anyio
async def test_checkin_promo_by_tier(staff_client: AsyncClient, mock_staff_service: MagicMock):
    member_id = uuid4()
    event_id = uuid4()
    mock_staff_service.checkin.return_value = {
        "status": "checked_in",
        "member_name": "Alice Smith",
        "event_title": "Friday Mixer",
        "fee": "0.00",
        "is_promo": True,
    }

    response = await staff_client.post(
        "/api/v1/staff/checkin",
        json={"member_id": str(member_id), "event_id": str(event_id)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["fee"] == "0.00"
    assert data["is_promo"] is True


@pytest.mark.anyio
async def test_checkin_vip_always_promo(staff_client: AsyncClient, mock_staff_service: MagicMock):
    member_id = uuid4()
    event_id = uuid4()
    mock_staff_service.checkin.return_value = {
        "status": "checked_in",
        "member_name": "VIP Member",
        "event_title": "Friday Mixer",
        "fee": "0.00",
        "is_promo": True,
    }

    response = await staff_client.post(
        "/api/v1/staff/checkin",
        json={"member_id": str(member_id), "event_id": str(event_id)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["fee"] == "0.00"
    assert data["is_promo"] is True


@pytest.mark.anyio
async def test_checkin_duplicate(staff_client: AsyncClient, mock_staff_service: MagicMock):
    from app.core.exceptions import AlreadyExistsError
    member_id = uuid4()
    event_id = uuid4()
    mock_staff_service.checkin.side_effect = AlreadyExistsError(
        message="Already checked in to this event."
    )

    response = await staff_client.post(
        "/api/v1/staff/checkin",
        json={"member_id": str(member_id), "event_id": str(event_id)},
    )

    assert response.status_code == 409
    assert "Already checked in" in response.json()["error"]["message"]


@pytest.mark.anyio
async def test_checkin_member_not_found(staff_client: AsyncClient, mock_staff_service: MagicMock):
    from app.core.exceptions import NotFoundError
    member_id = uuid4()
    event_id = uuid4()
    mock_staff_service.checkin.side_effect = NotFoundError(message="Member not found.")

    response = await staff_client.post(
        "/api/v1/staff/checkin",
        json={"member_id": str(member_id), "event_id": str(event_id)},
    )

    assert response.status_code == 404
    assert "Member not found" in response.json()["error"]["message"]


@pytest.mark.anyio
async def test_checkin_event_not_found(staff_client: AsyncClient, mock_staff_service: MagicMock):
    from app.core.exceptions import NotFoundError
    member_id = uuid4()
    event_id = uuid4()
    mock_staff_service.checkin.side_effect = NotFoundError(message="Event not found.")

    response = await staff_client.post(
        "/api/v1/staff/checkin",
        json={"member_id": str(member_id), "event_id": str(event_id)},
    )

    assert response.status_code == 404
    assert "Event not found" in response.json()["error"]["message"]


# ── Authorization ───────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_checkin_non_staff_forbidden(user_client: AsyncClient, mock_staff_service: MagicMock):
    member_id = uuid4()
    event_id = uuid4()

    response = await user_client.post(
        "/api/v1/staff/checkin",
        json={"member_id": str(member_id), "event_id": str(event_id)},
    )

    assert response.status_code == 403


@pytest.mark.anyio
async def test_get_member_non_staff_forbidden(user_client: AsyncClient):
    response = await user_client.get(f"/api/v1/staff/member/{uuid4()}")
    assert response.status_code == 403


@pytest.mark.anyio
async def test_today_events_non_staff_forbidden(user_client: AsyncClient):
    response = await user_client.get("/api/v1/staff/today-events")
    assert response.status_code == 403


# ── Admin: make-staff / revoke-staff ────────────────────────────────────────


@pytest.mark.anyio
async def test_admin_make_staff(admin_client: AsyncClient, mock_db_session):
    member = MockMember()
    member.role = "user"
    mock_db_session.get = AsyncMock(return_value=member)
    mock_db_session.commit = AsyncMock()

    response = await admin_client.post(f"/api/v1/admin/members/{member.id}/make-staff")

    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "staff"
    assert data["user_type"] == "staff"
    assert member.role == "staff"
    assert member.user_type == "staff"


@pytest.mark.anyio
async def test_admin_revoke_staff(admin_client: AsyncClient, mock_db_session):
    member = MockMember()
    member.role = "staff"
    member.user_type = "staff"
    mock_db_session.get = AsyncMock(return_value=member)
    mock_db_session.commit = AsyncMock()

    response = await admin_client.post(f"/api/v1/admin/members/{member.id}/revoke-staff")

    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "user"
    assert data["user_type"] == "member"
    assert member.role == "user"
    assert member.user_type == "member"


@pytest.mark.anyio
async def test_admin_make_staff_admin_protected(admin_client: AsyncClient, mock_db_session):
    member = MockMember()
    member.role = "admin"
    mock_db_session.get = AsyncMock(return_value=member)

    response = await admin_client.post(f"/api/v1/admin/members/{member.id}/make-staff")

    assert response.status_code == 400
    assert "admin" in response.json()["error"]["message"].lower()


@pytest.mark.anyio
async def test_admin_make_staff_not_found(admin_client: AsyncClient, mock_db_session):
    mock_db_session.get = AsyncMock(return_value=None)

    response = await admin_client.post(f"/api/v1/admin/members/{uuid4()}/make-staff")

    assert response.status_code == 404


# ── StaffService unit tests ─────────────────────────────────────────────────


@pytest.mark.anyio
async def test_staff_service_checkin_flow():
    """Integration test for StaffService.checkin() business logic."""
    from app.services.staff import StaffService

    db = AsyncMock()
    member = MockMember(tier="gold")
    event = MockEvent(ticket_price=Decimal("500.00"), promo_tiers=["gold"])

    db.get = AsyncMock(return_value=member)

    # Mock empty tap event query (no duplicate)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_result)

    service = StaffService(db)

    with (
        patch("app.services.staff.event_repo.get_by_id", new_callable=AsyncMock, return_value=event),
        patch("app.services.staff.nfc_repo.log_tap_event", new_callable=AsyncMock) as mock_log,
        patch("app.services.staff.tab_repo.get_open_tab", new_callable=AsyncMock, return_value=None),
        patch("app.services.staff.tab_repo.create_tab", new_callable=AsyncMock) as mock_create_tab,
        patch("app.services.staff.tab_repo.add_item", new_callable=AsyncMock),
        patch("app.services.staff.event_repo.add_rsvp", new_callable=AsyncMock),
        patch("app.services.staff.LoyaltyService.award_points", new_callable=AsyncMock),
    ):
        mock_tap = MagicMock()
        mock_tap.id = uuid4()
        mock_log.return_value = mock_tap

        mock_tab = MagicMock()
        mock_tab.id = uuid4()
        mock_create_tab.return_value = mock_tab

        staff_id = uuid4()
        result = await service.checkin(member.id, event.id, staff_id)

        assert result["status"] == "checked_in"
        assert result["is_promo"] is True  # gold in promo_tiers
        assert result["fee"] == "0.00"
        assert result["member_name"] == "Alice Smith"

        # Verify log_tap_event called with card_id=None
        mock_log.assert_called_once()
        call_kwargs = mock_log.call_args
        assert call_kwargs.kwargs.get("card_id") is None or call_kwargs[1].get("card_id") is None


@pytest.mark.anyio
async def test_staff_service_vip_always_promo():
    """VIP members always get free entry regardless of promo_tiers."""
    from app.services.staff import StaffService

    db = AsyncMock()
    member = MockMember(tier="vip")
    event = MockEvent(ticket_price=Decimal("1000.00"), promo_tiers=[])

    db.get = AsyncMock(return_value=member)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_result)

    service = StaffService(db)

    with (
        patch("app.services.staff.event_repo.get_by_id", new_callable=AsyncMock, return_value=event),
        patch("app.services.staff.nfc_repo.log_tap_event", new_callable=AsyncMock) as mock_log,
        patch("app.services.staff.tab_repo.get_open_tab", new_callable=AsyncMock, return_value=None),
        patch("app.services.staff.tab_repo.create_tab", new_callable=AsyncMock) as mock_create_tab,
        patch("app.services.staff.tab_repo.add_item", new_callable=AsyncMock),
        patch("app.services.staff.event_repo.add_rsvp", new_callable=AsyncMock),
        patch("app.services.staff.LoyaltyService.award_points", new_callable=AsyncMock),
    ):
        mock_tap = MagicMock()
        mock_tap.id = uuid4()
        mock_log.return_value = mock_tap

        mock_tab = MagicMock()
        mock_tab.id = uuid4()
        mock_create_tab.return_value = mock_tab

        result = await service.checkin(member.id, event.id, uuid4())

        assert result["is_promo"] is True
        assert result["fee"] == "0.00"


@pytest.mark.anyio
async def test_staff_service_no_tier_regular_price():
    """Members without a tier pay regular price."""
    from app.services.staff import StaffService

    db = AsyncMock()
    member = MockMember(tier=None)
    event = MockEvent(ticket_price=Decimal("500.00"), promo_tiers=["gold"])

    db.get = AsyncMock(return_value=member)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_result)

    service = StaffService(db)

    with (
        patch("app.services.staff.event_repo.get_by_id", new_callable=AsyncMock, return_value=event),
        patch("app.services.staff.nfc_repo.log_tap_event", new_callable=AsyncMock) as mock_log,
        patch("app.services.staff.tab_repo.get_open_tab", new_callable=AsyncMock, return_value=None),
        patch("app.services.staff.tab_repo.create_tab", new_callable=AsyncMock) as mock_create_tab,
        patch("app.services.staff.tab_repo.add_item", new_callable=AsyncMock),
        patch("app.services.staff.event_repo.add_rsvp", new_callable=AsyncMock),
        patch("app.services.staff.LoyaltyService.award_points", new_callable=AsyncMock),
    ):
        mock_tap = MagicMock()
        mock_tap.id = uuid4()
        mock_log.return_value = mock_tap

        mock_tab = MagicMock()
        mock_tab.id = uuid4()
        mock_create_tab.return_value = mock_tab

        result = await service.checkin(member.id, event.id, uuid4())

        assert result["is_promo"] is False
        assert result["fee"] == "500.00"


@pytest.mark.anyio
async def test_staff_service_duplicate_checkin():
    """Duplicate checkin returns 409."""
    from app.core.exceptions import AlreadyExistsError
    from app.services.staff import StaffService

    db = AsyncMock()
    member = MockMember()
    event = MockEvent()

    db.get = AsyncMock(return_value=member)

    # Mock existing tap for this event
    existing_tap = MockTapEvent(event_id=event.id, member_id=member.id)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [existing_tap]
    db.execute = AsyncMock(return_value=mock_result)

    service = StaffService(db)

    with patch("app.services.staff.event_repo.get_by_id", new_callable=AsyncMock, return_value=event):
        with pytest.raises(AlreadyExistsError, match="Already checked in"):
            await service.checkin(member.id, event.id, uuid4())


@pytest.mark.anyio
async def test_staff_service_inactive_member():
    """Inactive member returns 404."""
    from app.core.exceptions import NotFoundError
    from app.services.staff import StaffService

    db = AsyncMock()
    member = MockMember(is_active=False)
    db.get = AsyncMock(return_value=member)

    service = StaffService(db)

    with pytest.raises(NotFoundError, match="Member not found"):
        await service.checkin(member.id, uuid4(), uuid4())


# ── Role hierarchy tests ───────────────────────────────────────────────────


def test_has_role_hierarchy():
    """Admin > Staff > User role hierarchy."""
    from app.db.models.user import UserRole

    admin = MockUser(role="admin")
    staff = MockUser(role="staff")
    user = MockUser(role="user")

    # Admin can access all
    assert admin.has_role(UserRole.ADMIN) is True
    assert admin.has_role(UserRole.STAFF) is True
    assert admin.has_role(UserRole.USER) is True

    # Staff can access staff and user
    assert staff.has_role(UserRole.ADMIN) is False
    assert staff.has_role(UserRole.STAFF) is True
    assert staff.has_role(UserRole.USER) is True

    # User can only access user
    assert user.has_role(UserRole.ADMIN) is False
    assert user.has_role(UserRole.STAFF) is False
    assert user.has_role(UserRole.USER) is True
