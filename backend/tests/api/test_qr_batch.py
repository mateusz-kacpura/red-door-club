"""Tests for QR batch admin endpoints (/api/v1/admin/qr-batches/*)."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session
from app.core.config import settings
from app.main import app


class MockAdminUser:
    """Mock admin user for QR batch endpoint tests."""

    def __init__(self, user_id=None):
        self.id = user_id or uuid4()
        self.email = "admin@thereddoor.club"
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

    def has_role(self, _role) -> bool:
        return True


def _make_batch_row(
    *,
    batch_id=None,
    tier="silver",
    count=10,
    prefix="RD-",
    promo_code=None,
    promoter_id=None,
    notes=None,
):
    return MagicMock(
        id=batch_id or uuid4(),
        promoter_id=promoter_id,
        promo_code=promo_code,
        tier=tier,
        count=count,
        prefix=prefix,
        notes=notes,
        created_by=uuid4(),
        created_at=datetime.now(UTC),
    )


def _make_code_row(*, pass_id="RD-000001", converted=False):
    return MagicMock(
        id=uuid4(),
        batch_id=uuid4(),
        pass_id=pass_id,
        converted_at=datetime.now(UTC) if converted else None,
        registered_user_id=uuid4() if converted else None,
        created_at=datetime.now(UTC),
    )


@pytest.fixture
def admin_user() -> MockAdminUser:
    return MockAdminUser()


@pytest.fixture
async def qr_client(admin_user: MockAdminUser, mock_db_session) -> AsyncClient:
    """Async HTTP client authenticated as admin for QR batch endpoint tests."""
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


BASE = f"{settings.API_V1_STR}/admin/qr-batches"


# ── GET /admin/qr-batches ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_qr_batches_empty(qr_client: AsyncClient, mock_db_session):
    """Returns empty list when no batches exist."""
    count_result = MagicMock()
    count_result.scalar.return_value = 0

    scalars_result = MagicMock()
    scalars_result.scalars.return_value.all.return_value = []

    mock_db_session.execute = AsyncMock(return_value=scalars_result)

    with patch("app.services.qr_batch.list_batches", AsyncMock(return_value=[])):
        response = await qr_client.get(BASE)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_qr_batches_returns_batches_with_conversion_rate(
    qr_client: AsyncClient, mock_db_session
):
    """Returns batch list with computed conversion_rate and converted_count."""
    batch = _make_batch_row(count=10, tier="gold", prefix="RD-", promo_code="PRO-01")

    # mock_db_session.execute called once per batch to count conversions
    count_result = MagicMock()
    count_result.scalar.return_value = 3  # 3 conversions out of 10

    mock_db_session.execute = AsyncMock(return_value=count_result)

    with patch("app.services.qr_batch.list_batches", AsyncMock(return_value=[batch])):
        response = await qr_client.get(BASE)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["tier"] == "gold"
    assert data[0]["count"] == 10
    assert data[0]["converted_count"] == 3
    assert data[0]["conversion_rate"] == pytest.approx(0.3, abs=0.01)


@pytest.mark.anyio
async def test_list_qr_batches_zero_conversion_when_no_converted(
    qr_client: AsyncClient, mock_db_session
):
    """Conversion rate is 0.0 when no conversions."""
    batch = _make_batch_row(count=5)

    count_result = MagicMock()
    count_result.scalar.return_value = 0

    mock_db_session.execute = AsyncMock(return_value=count_result)

    with patch("app.services.qr_batch.list_batches", AsyncMock(return_value=[batch])):
        response = await qr_client.get(BASE)

    assert response.status_code == 200
    data = response.json()
    assert data[0]["conversion_rate"] == 0.0
    assert data[0]["converted_count"] == 0


# ── POST /admin/qr-batches ────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_create_qr_batch_success(qr_client: AsyncClient):
    """POST creates a batch and returns 201."""
    created = _make_batch_row(count=5, tier="silver", prefix="RD-")

    with patch("app.services.qr_batch.create_batch", AsyncMock(return_value=created)):
        response = await qr_client.post(
            BASE,
            json={"tier": "silver", "count": 5, "prefix": "RD-"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["tier"] == "silver"
    assert data["count"] == 5
    assert data["converted_count"] == 0
    assert data["conversion_rate"] == 0.0


@pytest.mark.anyio
async def test_create_qr_batch_with_optional_fields(qr_client: AsyncClient):
    """POST accepts optional promoter_id, promo_code, notes."""
    promoter_id = uuid4()
    created = _make_batch_row(
        count=20,
        tier="gold",
        prefix="VIP-",
        promo_code="PRO-07",
        promoter_id=promoter_id,
        notes="VIP event batch",
    )

    with patch("app.services.qr_batch.create_batch", AsyncMock(return_value=created)):
        response = await qr_client.post(
            BASE,
            json={
                "tier": "gold",
                "count": 20,
                "prefix": "VIP-",
                "promo_code": "PRO-07",
                "promoter_id": str(promoter_id),
                "notes": "VIP event batch",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["promo_code"] == "PRO-07"
    assert data["notes"] == "VIP event batch"


@pytest.mark.anyio
async def test_create_qr_batch_count_too_large(qr_client: AsyncClient):
    """POST rejects count > 500 with 422."""
    response = await qr_client.post(
        BASE,
        json={"tier": "silver", "count": 501, "prefix": "RD-"},
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_create_qr_batch_count_zero_rejected(qr_client: AsyncClient):
    """POST rejects count < 1 with 422."""
    response = await qr_client.post(
        BASE,
        json={"tier": "silver", "count": 0, "prefix": "RD-"},
    )
    assert response.status_code == 422


# ── GET /admin/qr-batches/{id} ────────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_qr_batch_detail_not_found(qr_client: AsyncClient):
    """GET /{id} returns 404 when batch does not exist."""
    with patch("app.services.qr_batch.get_batch_with_codes", AsyncMock(return_value=None)):
        response = await qr_client.get(f"{BASE}/{uuid4()}")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_get_qr_batch_detail_returns_codes(qr_client: AsyncClient):
    """GET /{id} returns batch with its codes."""
    batch = _make_batch_row(count=3, tier="obsidian")
    codes = [
        _make_code_row(pass_id="RD-000001"),
        _make_code_row(pass_id="RD-000002", converted=True),
        _make_code_row(pass_id="RD-000003"),
    ]

    with patch(
        "app.services.qr_batch.get_batch_with_codes",
        AsyncMock(return_value=(batch, codes)),
    ):
        response = await qr_client.get(f"{BASE}/{batch.id}")

    assert response.status_code == 200
    data = response.json()
    assert len(data["codes"]) == 3
    assert data["tier"] == "obsidian"
    assert data["conversion_rate"] == pytest.approx(1 / 3, abs=0.01)
    assert data["converted_count"] == 1


@pytest.mark.anyio
async def test_get_qr_batch_detail_all_converted(qr_client: AsyncClient):
    """GET /{id} conversion_rate is 1.0 when all codes converted."""
    batch = _make_batch_row(count=2)
    codes = [
        _make_code_row(pass_id="RD-000001", converted=True),
        _make_code_row(pass_id="RD-000002", converted=True),
    ]

    with patch(
        "app.services.qr_batch.get_batch_with_codes",
        AsyncMock(return_value=(batch, codes)),
    ):
        response = await qr_client.get(f"{BASE}/{batch.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["conversion_rate"] == 1.0
    assert data["converted_count"] == 2


# ── GET /admin/qr-batches/{id}/pdf ────────────────────────────────────────────


@pytest.mark.anyio
async def test_download_pdf_not_found(qr_client: AsyncClient):
    """GET /{id}/pdf returns 404 when batch does not exist."""
    with patch("app.services.qr_batch.get_batch_with_codes", AsyncMock(return_value=None)):
        response = await qr_client.get(f"{BASE}/{uuid4()}/pdf")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_download_pdf_success_returns_pdf_content_type(qr_client: AsyncClient):
    """GET /{id}/pdf returns application/pdf with PDF magic bytes."""
    batch = _make_batch_row(count=2)
    codes = [_make_code_row(pass_id="RD-000001"), _make_code_row(pass_id="RD-000002")]

    fake_pdf = b"%PDF-1.4 fake pdf bytes for testing"

    with (
        patch("app.services.qr_batch.get_batch_with_codes", AsyncMock(return_value=(batch, codes))),
        patch("app.services.qr_batch.generate_pdf", return_value=fake_pdf),
    ):
        response = await qr_client.get(f"{BASE}/{batch.id}/pdf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content == fake_pdf


@pytest.mark.anyio
async def test_download_pdf_content_disposition_header(qr_client: AsyncClient):
    """GET /{id}/pdf includes Content-Disposition: attachment header."""
    batch = _make_batch_row()
    codes = [_make_code_row()]
    fake_pdf = b"%PDF fake"

    with (
        patch("app.services.qr_batch.get_batch_with_codes", AsyncMock(return_value=(batch, codes))),
        patch("app.services.qr_batch.generate_pdf", return_value=fake_pdf),
    ):
        response = await qr_client.get(f"{BASE}/{batch.id}/pdf")

    assert "attachment" in response.headers.get("content-disposition", "").lower()


# ── Auth: pass_id tracking in registration ────────────────────────────────────


@pytest.mark.anyio
async def test_register_with_pass_id_calls_mark_converted(mock_redis, mock_db_session):
    """POST /auth/register with pass_id calls mark_converted after user creation."""
    from app.api.deps import get_user_service

    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.email = "new@example.com"
    mock_user.full_name = "New Member"
    mock_user.is_active = True
    mock_user.is_superuser = False
    mock_user.hashed_password = "hashed"
    mock_user.role = "user"
    mock_user.tier = None
    mock_user.company_name = None
    mock_user.industry = None
    mock_user.revenue_range = None
    mock_user.phone = None
    mock_user.segment_groups = []
    mock_user.interests = []
    mock_user.pdpa_consent = False
    mock_user.user_type = "prospect"
    mock_user.last_seen_at = None
    mock_user.staff_notes = None
    mock_user.created_at = datetime.now(UTC)
    mock_user.updated_at = datetime.now(UTC)

    mock_user_service = MagicMock()
    mock_user_service.register = AsyncMock(return_value=mock_user)

    from app.api.deps import get_redis

    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_redis] = lambda: mock_redis
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    with patch("app.services.qr_batch.mark_converted", AsyncMock(return_value=True)) as mock_mark:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                f"{settings.API_V1_STR}/auth/register",
                json={
                    "email": "new@example.com",
                    "password": "password123",
                    "full_name": "New Member",
                    "pass_id": "RD-000042",
                },
            )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    mock_mark.assert_awaited_once()
    call_args = mock_mark.call_args
    assert call_args.args[1] == "RD-000042"
    assert call_args.args[2] == mock_user.id


@pytest.mark.anyio
async def test_register_without_pass_id_does_not_call_mark_converted(mock_redis, mock_db_session):
    """POST /auth/register without pass_id does NOT call mark_converted."""
    from app.api.deps import get_user_service

    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.email = "other@example.com"
    mock_user.full_name = "Other User"
    mock_user.is_active = True
    mock_user.is_superuser = False
    mock_user.hashed_password = "hashed"
    mock_user.role = "user"
    mock_user.tier = None
    mock_user.company_name = None
    mock_user.industry = None
    mock_user.revenue_range = None
    mock_user.phone = None
    mock_user.segment_groups = []
    mock_user.interests = []
    mock_user.pdpa_consent = False
    mock_user.user_type = "prospect"
    mock_user.last_seen_at = None
    mock_user.staff_notes = None
    mock_user.created_at = datetime.now(UTC)
    mock_user.updated_at = datetime.now(UTC)

    mock_user_service = MagicMock()
    mock_user_service.register = AsyncMock(return_value=mock_user)

    from app.api.deps import get_redis

    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_redis] = lambda: mock_redis
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    with patch("app.services.qr_batch.mark_converted", AsyncMock(return_value=True)) as mock_mark:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            await ac.post(
                f"{settings.API_V1_STR}/auth/register",
                json={
                    "email": "other@example.com",
                    "password": "password123",
                },
            )

    app.dependency_overrides.clear()

    mock_mark.assert_not_awaited()


@pytest.mark.anyio
async def test_register_mark_converted_failure_does_not_block_registration(
    mock_redis, mock_db_session
):
    """mark_converted failure should be silently caught and not return 500."""
    from app.api.deps import get_user_service

    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.email = "resilient@example.com"
    mock_user.full_name = "Resilient User"
    mock_user.is_active = True
    mock_user.is_superuser = False
    mock_user.hashed_password = "hashed"
    mock_user.role = "user"
    mock_user.tier = None
    mock_user.company_name = None
    mock_user.industry = None
    mock_user.revenue_range = None
    mock_user.phone = None
    mock_user.segment_groups = []
    mock_user.interests = []
    mock_user.pdpa_consent = False
    mock_user.user_type = "prospect"
    mock_user.last_seen_at = None
    mock_user.staff_notes = None
    mock_user.created_at = datetime.now(UTC)
    mock_user.updated_at = datetime.now(UTC)

    mock_user_service = MagicMock()
    mock_user_service.register = AsyncMock(return_value=mock_user)

    from app.api.deps import get_redis

    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_redis] = lambda: mock_redis
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    with patch(
        "app.services.qr_batch.mark_converted",
        AsyncMock(side_effect=Exception("DB connection lost")),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                f"{settings.API_V1_STR}/auth/register",
                json={
                    "email": "resilient@example.com",
                    "password": "password123",
                    "pass_id": "RD-000099",
                },
            )

    app.dependency_overrides.clear()

    # Registration should succeed even though mark_converted threw
    assert response.status_code == 201
