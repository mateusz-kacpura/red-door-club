"""Tests for corporate routes (/api/v1/corporate/*)."""

from datetime import datetime, UTC
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session
from app.core.config import settings
from app.main import app


class MockAdminUser:
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
        return True


def _make_corp(
    company_name="Acme Corp",
    package_type="starter",
    max_seats=5,
    active_seats=2,
    status="active",
):
    c = MagicMock()
    c.id = uuid4()
    c.company_name = company_name
    c.billing_contact_name = "John Smith"
    c.billing_contact_email = "john@acme.com"
    c.billing_address = "123 Main St, Bangkok"
    c.vat_number = None
    c.package_type = package_type
    c.max_seats = max_seats
    c.active_seats = active_seats
    c.annual_fee = Decimal("120000.00")
    c.renewal_date = None
    c.status = status
    c.created_at = datetime.now(UTC)
    return c


@pytest.fixture
def mock_admin_user() -> MockAdminUser:
    return MockAdminUser()


@pytest.fixture
async def admin_client(
    mock_admin_user: MockAdminUser,
    mock_redis,
    mock_db_session,
) -> AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: mock_admin_user
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.get = AsyncMock(return_value=None)
    mock_db_session.scalar = AsyncMock(return_value=0)
    mock_db_session.add = MagicMock()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── GET /corporate ────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_corporate_empty(admin_client: AsyncClient, mock_db_session):
    """GET /corporate returns empty list when no accounts exist."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/corporate")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_corporate_with_accounts(admin_client: AsyncClient, mock_db_session):
    """GET /corporate returns serialised corporate accounts."""
    corp = _make_corp("Globex Ltd")
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [corp]
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/corporate")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["company_name"] == "Globex Ltd"
    assert data[0]["status"] == "active"


# ── POST /corporate ────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_create_corporate_account_success(admin_client: AsyncClient, mock_db_session):
    """POST /corporate creates a new account and returns it."""
    corp = _make_corp("Initech Inc", package_type="business", max_seats=20)
    mock_db_session.refresh = AsyncMock(side_effect=lambda obj: None)

    from unittest.mock import patch
    with patch("app.api.routes.v1.corporate.CorporateAccount", return_value=corp):
        response = await admin_client.post(
            f"{settings.API_V1_STR}/corporate",
            json={
                "company_name": "Initech Inc",
                "billing_contact_name": "Bill Lumbergh",
                "billing_contact_email": "bill@initech.com",
                "billing_address": "999 Office Park, Bangkok",
                "package_type": "business",
                "annual_fee": "240000.00",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["company_name"] == "Initech Inc"
    assert data["package_type"] == "business"


@pytest.mark.anyio
async def test_create_corporate_missing_required_fields(admin_client: AsyncClient):
    """POST /corporate with missing required fields returns 422."""
    response = await admin_client.post(
        f"{settings.API_V1_STR}/corporate",
        json={"company_name": "Incomplete Co"},
    )

    assert response.status_code == 422


# ── GET /corporate/{id} ───────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_corporate_not_found(admin_client: AsyncClient, mock_db_session):
    """GET /corporate/{id} returns 404 when account doesn't exist."""
    mock_db_session.get = AsyncMock(return_value=None)

    response = await admin_client.get(f"{settings.API_V1_STR}/corporate/{uuid4()}")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_get_corporate_found(admin_client: AsyncClient, mock_db_session):
    """GET /corporate/{id} returns account detail with members list."""
    corp = _make_corp("Big Corp")
    mock_db_session.get = AsyncMock(return_value=corp)

    # Members query returns empty
    mock_members_result = MagicMock()
    mock_members_result.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_members_result)

    response = await admin_client.get(f"{settings.API_V1_STR}/corporate/{corp.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["company_name"] == "Big Corp"
    assert data["members"] == []


# ── PATCH /corporate/{id} ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_update_corporate_status(admin_client: AsyncClient, mock_db_session):
    """PATCH /corporate/{id} can update account status."""
    corp = _make_corp(status="active")
    mock_db_session.get = AsyncMock(return_value=corp)
    mock_db_session.refresh = AsyncMock(side_effect=lambda obj: None)

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/corporate/{corp.id}",
        json={"status": "suspended"},
    )

    assert response.status_code == 200
    # The mock corp object gets mutated
    assert corp.status == "suspended"


@pytest.mark.anyio
async def test_update_corporate_not_found(admin_client: AsyncClient, mock_db_session):
    """PATCH /corporate/{id} returns 404 for unknown account."""
    mock_db_session.get = AsyncMock(return_value=None)

    response = await admin_client.patch(
        f"{settings.API_V1_STR}/corporate/{uuid4()}",
        json={"status": "suspended"},
    )

    assert response.status_code == 404


# ── POST /corporate/{id}/members ──────────────────────────────────────────────


@pytest.mark.anyio
async def test_add_member_account_not_found(admin_client: AsyncClient, mock_db_session):
    """POST /corporate/{id}/members returns 404 if account doesn't exist."""
    mock_db_session.get = AsyncMock(return_value=None)

    response = await admin_client.post(
        f"{settings.API_V1_STR}/corporate/{uuid4()}/members",
        json={"email": "member@example.com"},
    )

    assert response.status_code == 404


@pytest.mark.anyio
async def test_add_member_seat_limit_reached(admin_client: AsyncClient, mock_db_session):
    """POST /corporate/{id}/members returns 400 when seats are full."""
    corp = _make_corp(max_seats=5, active_seats=5)
    mock_db_session.get = AsyncMock(return_value=corp)

    response = await admin_client.post(
        f"{settings.API_V1_STR}/corporate/{corp.id}/members",
        json={"email": "member@example.com"},
    )

    assert response.status_code == 400


@pytest.mark.anyio
async def test_add_member_user_not_found(admin_client: AsyncClient, mock_db_session):
    """POST /corporate/{id}/members returns 404 if member email not found."""
    corp = _make_corp(max_seats=5, active_seats=2)
    mock_db_session.get = AsyncMock(return_value=corp)

    # User query returns None
    mock_user_result = MagicMock()
    mock_user_result.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(return_value=mock_user_result)

    response = await admin_client.post(
        f"{settings.API_V1_STR}/corporate/{corp.id}/members",
        json={"email": "unknown@example.com"},
    )

    assert response.status_code == 404
