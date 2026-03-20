"""Tests for promoter routes (/api/v1/promoters/*)."""

from datetime import datetime, UTC
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session
from app.core.config import settings
from app.main import app


class MockPromoterUser:
    """Mock user with promoter status."""

    def __init__(self, id=None, email="promoter@example.com"):
        self.id = id or uuid4()
        self.email = email
        self.role = "user"
        self.full_name = "Pro Moter"
        self.is_active = True
        self.is_superuser = False
        self.is_promoter = True
        self.tier = "gold"
        self.segment_groups = []
        self.user_type = "promoter"
        self.hashed_password = "hashed"
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)

    def has_role(self, required_role) -> bool:
        if hasattr(required_role, "value"):
            return self.role == required_role.value
        return self.role == required_role


def _make_promo_code(code="PRO-01"):
    m = MagicMock()
    m.id = uuid4()
    m.code = code
    m.promoter_id = uuid4()
    m.tier_grant = None
    m.quota = 0
    m.uses_count = 3
    m.revenue_attributed = Decimal("1500.00")
    m.commission_rate = Decimal("0.50")
    m.is_active = True
    m.created_at = datetime.now(UTC)
    return m


def _make_payout():
    p = MagicMock()
    p.id = uuid4()
    p.promoter_id = uuid4()
    p.amount = Decimal("250.00")
    p.status = "pending"
    p.notes = None
    p.created_at = datetime.now(UTC)
    p.processed_at = None
    return p


@pytest.fixture
def mock_promoter_user() -> MockPromoterUser:
    return MockPromoterUser()


@pytest.fixture
async def promoter_client(
    mock_promoter_user: MockPromoterUser,
    mock_redis,
    mock_db_session,
) -> AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: mock_promoter_user
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.scalar = AsyncMock(return_value=Decimal("0.00"))
    mock_db_session.add = MagicMock()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── GET /promoters/me/dashboard ───────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_promoter_dashboard_empty(
    promoter_client: AsyncClient,
    mock_db_session,
):
    """GET /promoters/me/dashboard returns zero stats when no codes exist."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.scalar = AsyncMock(return_value=Decimal("0.00"))

    response = await promoter_client.get(f"{settings.API_V1_STR}/promoters/me/dashboard")

    assert response.status_code == 200
    data = response.json()
    assert data["total_codes"] == 0
    assert data["total_uses"] == 0
    assert data["total_revenue"] == 0.0


@pytest.mark.anyio
async def test_get_promoter_dashboard_with_codes(
    promoter_client: AsyncClient,
    mock_promoter_user: MockPromoterUser,
    mock_db_session,
):
    """GET /promoters/me/dashboard returns computed stats from promo codes."""
    code = _make_promo_code()
    code.uses_count = 10
    code.revenue_attributed = Decimal("5000.00")
    code.commission_rate = Decimal("0.50")

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [code]
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.scalar = AsyncMock(return_value=Decimal("0.00"))

    response = await promoter_client.get(f"{settings.API_V1_STR}/promoters/me/dashboard")

    assert response.status_code == 200
    data = response.json()
    assert data["total_codes"] == 1
    assert data["total_uses"] == 10
    assert data["total_revenue"] == 5000.0
    assert data["commission_earned"] == 2500.0


# ── GET /promoters/me/codes ───────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_my_codes_empty(promoter_client: AsyncClient, mock_db_session):
    """GET /promoters/me/codes returns empty list when no codes."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await promoter_client.get(f"{settings.API_V1_STR}/promoters/me/codes")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_my_codes_with_data(promoter_client: AsyncClient, mock_db_session):
    """GET /promoters/me/codes returns serialised promo codes."""
    code = _make_promo_code("VIP-01")
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [code]
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await promoter_client.get(f"{settings.API_V1_STR}/promoters/me/codes")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["code"] == "VIP-01"


# ── GET /promoters/me/payouts ─────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_my_payouts_empty(promoter_client: AsyncClient, mock_db_session):
    """GET /promoters/me/payouts returns empty list initially."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await promoter_client.get(f"{settings.API_V1_STR}/promoters/me/payouts")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_my_payouts_with_data(promoter_client: AsyncClient, mock_db_session):
    """GET /promoters/me/payouts returns serialised payout requests."""
    payout = _make_payout()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [payout]
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await promoter_client.get(f"{settings.API_V1_STR}/promoters/me/payouts")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "pending"
    assert float(data[0]["amount"]) == 250.0


# ── POST /promoters/me/request-payout ────────────────────────────────────────


@pytest.mark.anyio
async def test_request_payout_success(promoter_client: AsyncClient, mock_db_session):
    """POST /promoters/me/request-payout creates a payout request."""
    payout = _make_payout()
    mock_db_session.refresh = AsyncMock()

    from unittest.mock import patch
    with patch("app.services.promoter.PayoutRequest", return_value=payout):
        response = await promoter_client.post(
            f"{settings.API_V1_STR}/promoters/me/request-payout",
            json={"amount": "250.00"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"


@pytest.mark.anyio
async def test_request_payout_zero_amount_rejected(promoter_client: AsyncClient):
    """POST /promoters/me/request-payout with zero amount should fail."""
    response = await promoter_client.post(
        f"{settings.API_V1_STR}/promoters/me/request-payout",
        json={"amount": "0.00"},
    )

    assert response.status_code in (400, 422)


# ── GET /promoters/leaderboard ────────────────────────────────────────────────


@pytest.mark.anyio
async def test_leaderboard_returns_list(promoter_client: AsyncClient, mock_db_session):
    """GET /promoters/leaderboard returns a (possibly empty) list."""
    mock_result = MagicMock()
    mock_result.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    response = await promoter_client.get(f"{settings.API_V1_STR}/promoters/leaderboard")

    assert response.status_code == 200
    assert response.json() == []
