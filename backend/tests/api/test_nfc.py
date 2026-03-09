"""Tests for NFC card routes."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session, get_redis
from app.api.routes.v1.nfc import get_nfc_service
from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.main import app


class MockUser:
    """Mock user for NFC tests."""

    def __init__(self, id=None, email="user@example.com", role="user", is_active=True):
        self.id = id or uuid4()
        self.email = email
        self.role = role
        self.full_name = "Test User"
        self.is_active = is_active
        self.created_at = datetime.now(UTC)

    def has_role(self, required_role) -> bool:
        if self.role == "admin":
            return True
        if hasattr(required_role, "value"):
            return self.role == required_role.value
        return self.role == required_role


@pytest.fixture
def mock_nfc_service() -> MagicMock:
    service = MagicMock()
    service.handle_tap = AsyncMock()
    service.bind_card = AsyncMock()
    service.suspend_card = AsyncMock()
    service.batch_import = AsyncMock()
    service.get_member_cards = AsyncMock(return_value=[])
    service.get_card_status = AsyncMock()
    # Phase 2
    service.handle_connection_tap = AsyncMock()
    service.handle_payment_tap = AsyncMock()
    service.handle_locker_tap = AsyncMock()
    return service


@pytest.fixture
def mock_user() -> MockUser:
    return MockUser()


@pytest.fixture
def mock_admin_user() -> MockUser:
    return MockUser(role="admin", email="admin@example.com")


@pytest.fixture
async def public_client(mock_nfc_service: MagicMock, mock_redis, mock_db_session):
    """Client with NFC service override but no user auth (public tap endpoint)."""
    app.dependency_overrides[get_nfc_service] = lambda: mock_nfc_service
    app.dependency_overrides[get_db_session] = lambda: mock_db_session
    app.dependency_overrides[get_redis] = lambda: mock_redis

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def user_client(mock_nfc_service: MagicMock, mock_user: MockUser, mock_redis, mock_db_session):
    """Client with NFC service + authenticated regular user."""
    app.dependency_overrides[get_nfc_service] = lambda: mock_nfc_service
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db_session] = lambda: mock_db_session
    app.dependency_overrides[get_redis] = lambda: mock_redis

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def admin_client(mock_nfc_service: MagicMock, mock_admin_user: MockUser, mock_redis, mock_db_session):
    """Client with NFC service + authenticated admin user."""
    app.dependency_overrides[get_nfc_service] = lambda: mock_nfc_service
    app.dependency_overrides[get_current_user] = lambda: mock_admin_user
    app.dependency_overrides[get_db_session] = lambda: mock_db_session
    app.dependency_overrides[get_redis] = lambda: mock_redis

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Tap endpoint (public) ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_tap_unbound_card(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """GET /nfc/tap returns setup action for an unbound card."""
    from app.schemas.nfc import TapResponse

    mock_nfc_service.handle_tap.return_value = TapResponse(
        action="setup",
        redirect_url="/setup?cid=RD-NFC-001",
        message="Complete your profile.",
    )

    response = await public_client.get(f"{settings.API_V1_STR}/nfc/tap?cid=RD-NFC-001")

    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "setup"
    assert "RD-NFC-001" in data["redirect_url"]
    mock_nfc_service.handle_tap.assert_called_once_with(
        "RD-NFC-001", reader_id=None, location=None
    )


@pytest.mark.anyio
async def test_tap_active_card_welcome(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """GET /nfc/tap returns welcome action for an active card."""
    from app.schemas.nfc import TapResponse

    member_id = uuid4()
    mock_nfc_service.handle_tap.return_value = TapResponse(
        action="welcome",
        member_id=member_id,
        member_name="Jane Smith",
        message="Welcome back, Jane Smith!",
    )

    response = await public_client.get(f"{settings.API_V1_STR}/nfc/tap?cid=RD-NFC-002")

    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "welcome"
    assert data["member_name"] == "Jane Smith"
    assert "Welcome back" in data["message"]


@pytest.mark.anyio
async def test_tap_suspended_card(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """GET /nfc/tap returns card_suspended action for a deactivated card."""
    from app.schemas.nfc import TapResponse

    mock_nfc_service.handle_tap.return_value = TapResponse(
        action="card_suspended",
        message="This card has been deactivated.",
    )

    response = await public_client.get(f"{settings.API_V1_STR}/nfc/tap?cid=RD-NFC-003")

    assert response.status_code == 200
    assert response.json()["action"] == "card_suspended"


@pytest.mark.anyio
async def test_tap_card_not_found(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """GET /nfc/tap returns 404 when card does not exist."""
    mock_nfc_service.handle_tap.side_effect = NotFoundError(message="NFC card not found: UNKNOWN")

    response = await public_client.get(f"{settings.API_V1_STR}/nfc/tap?cid=UNKNOWN")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_tap_missing_cid(public_client: AsyncClient):
    """GET /nfc/tap returns 422 when cid query param is absent."""
    response = await public_client.get(f"{settings.API_V1_STR}/nfc/tap")

    assert response.status_code == 422


@pytest.mark.anyio
async def test_tap_with_reader_id_and_location(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """GET /nfc/tap passes reader_id and location to service."""
    from app.schemas.nfc import TapResponse

    mock_nfc_service.handle_tap.return_value = TapResponse(action="welcome")

    await public_client.get(
        f"{settings.API_V1_STR}/nfc/tap?cid=RD-001&reader_id=READER-A&location=entrance"
    )

    mock_nfc_service.handle_tap.assert_called_once_with(
        "RD-001", reader_id="READER-A", location="entrance"
    )


# ── Bind card (authenticated user) ───────────────────────────────────────────


@pytest.mark.anyio
async def test_bind_card_success(user_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/bind binds an unbound card to the current user."""
    mock_nfc_service.bind_card.return_value = {
        "card_id": "RD-NFC-001",
        "status": "active",
        "message": "Card activated successfully.",
    }

    response = await user_client.post(
        f"{settings.API_V1_STR}/nfc/bind",
        json={"card_id": "RD-NFC-001"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"


@pytest.mark.anyio
async def test_bind_card_not_found(user_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/bind returns 404 when card doesn't exist."""
    mock_nfc_service.bind_card.side_effect = NotFoundError(message="NFC card not found: INVALID")

    response = await user_client.post(
        f"{settings.API_V1_STR}/nfc/bind",
        json={"card_id": "INVALID"},
    )

    assert response.status_code == 404


@pytest.mark.anyio
async def test_bind_card_already_bound(user_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/bind returns 400 when card is already bound."""
    mock_nfc_service.bind_card.side_effect = BadRequestError(
        message="Card 'RD-NFC-001' is already bound or inactive."
    )

    response = await user_client.post(
        f"{settings.API_V1_STR}/nfc/bind",
        json={"card_id": "RD-NFC-001"},
    )

    assert response.status_code == 400


# ── Admin endpoints ───────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_suspend_card_as_admin(admin_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/card/{id}/suspend suspends a card (admin only)."""
    mock_nfc_service.suspend_card.return_value = {"card_id": "RD-NFC-001", "status": "suspended"}

    response = await admin_client.post(f"{settings.API_V1_STR}/nfc/card/RD-NFC-001/suspend")

    assert response.status_code == 200
    assert response.json()["status"] == "suspended"


@pytest.mark.anyio
async def test_suspend_card_not_found(admin_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/card/{id}/suspend returns 404 for unknown card."""
    mock_nfc_service.suspend_card.side_effect = NotFoundError(message="NFC card not found: X")

    response = await admin_client.post(f"{settings.API_V1_STR}/nfc/card/X/suspend")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_batch_import_success(admin_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/batch-import imports cards and returns count."""
    mock_nfc_service.batch_import.return_value = 3

    response = await admin_client.post(
        f"{settings.API_V1_STR}/nfc/batch-import",
        json=[
            {"card_id": "RD-001", "tier_at_issue": "silver"},
            {"card_id": "RD-002", "tier_at_issue": "gold"},
            {"card_id": "RD-003", "tier_at_issue": None},
        ],
    )

    assert response.status_code == 200
    data = response.json()
    assert data["imported"] == 3
    assert "3 cards" in data["message"]


@pytest.mark.anyio
async def test_get_my_cards(user_client: AsyncClient, mock_nfc_service: MagicMock):
    """GET /nfc/my-cards returns the current user's NFC cards."""
    mock_nfc_service.get_member_cards.return_value = []

    response = await user_client.get(f"{settings.API_V1_STR}/nfc/my-cards")

    assert response.status_code == 200
    assert response.json() == []


# ── Phase 2 endpoints ─────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_connection_tap_success(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/connection-tap creates a connection between two members."""
    from app.schemas.nfc import TapResponse

    member_id = uuid4()
    mock_nfc_service.handle_connection_tap.return_value = TapResponse(
        action="connection_made",
        member_id=member_id,
        member_name="Bob Jones",
        message="Connected with Bob Jones!",
    )

    response = await public_client.post(
        f"{settings.API_V1_STR}/nfc/connection-tap",
        json={"card_id_a": "RD-001", "card_id_b": "RD-002"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "connection_made"
    assert data["member_name"] == "Bob Jones"
    mock_nfc_service.handle_connection_tap.assert_called_once_with(
        "RD-001", "RD-002", reader_id=None, location=None
    )


@pytest.mark.anyio
async def test_connection_tap_card_not_found(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/connection-tap returns 404 when a card is unknown."""
    mock_nfc_service.handle_connection_tap.side_effect = NotFoundError(message="Card not found")

    response = await public_client.post(
        f"{settings.API_V1_STR}/nfc/connection-tap",
        json={"card_id_a": "UNKNOWN", "card_id_b": "RD-002"},
    )

    assert response.status_code == 404


@pytest.mark.anyio
async def test_connection_tap_already_connected(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/connection-tap returns 409 when members are already connected."""
    from app.core.exceptions import AlreadyExistsError

    mock_nfc_service.handle_connection_tap.side_effect = AlreadyExistsError(
        message="These members are already connected."
    )

    response = await public_client.post(
        f"{settings.API_V1_STR}/nfc/connection-tap",
        json={"card_id_a": "RD-001", "card_id_b": "RD-002"},
    )

    assert response.status_code == 409


@pytest.mark.anyio
async def test_payment_tap_success(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/payment-tap adds item to member tab."""
    from app.schemas.nfc import TapResponse

    member_id = uuid4()
    mock_nfc_service.handle_payment_tap.return_value = TapResponse(
        action="payment_added",
        member_id=member_id,
        member_name="Alice Smith",
        message="Added Whisky Sour (฿350) to tab. Total: ฿350",
    )

    response = await public_client.post(
        f"{settings.API_V1_STR}/nfc/payment-tap",
        json={"card_id": "RD-001", "amount": "350.00", "description": "Whisky Sour"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "payment_added"
    assert "Whisky Sour" in data["message"]
    mock_nfc_service.handle_payment_tap.assert_called_once()


@pytest.mark.anyio
async def test_payment_tap_card_not_found(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/payment-tap returns 404 when card doesn't exist."""
    mock_nfc_service.handle_payment_tap.side_effect = NotFoundError(message="Card not found")

    response = await public_client.post(
        f"{settings.API_V1_STR}/nfc/payment-tap",
        json={"card_id": "UNKNOWN", "amount": "100.00", "description": "Drink"},
    )

    assert response.status_code == 404


@pytest.mark.anyio
async def test_locker_tap_assign(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/locker-tap assigns locker to member."""
    from app.schemas.nfc import TapResponse

    member_id = uuid4()
    mock_nfc_service.handle_locker_tap.return_value = TapResponse(
        action="locker_assigned",
        member_id=member_id,
        message="Locker A01 assigned to you.",
    )

    response = await public_client.post(
        f"{settings.API_V1_STR}/nfc/locker-tap",
        json={"card_id": "RD-001", "locker_number": "A01"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "locker_assigned"
    mock_nfc_service.handle_locker_tap.assert_called_once_with(
        "RD-001", "A01", reader_id=None
    )


@pytest.mark.anyio
async def test_locker_tap_release(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/locker-tap releases locker on second tap."""
    from app.schemas.nfc import TapResponse

    mock_nfc_service.handle_locker_tap.return_value = TapResponse(
        action="locker_released",
        message="Locker A01 released.",
    )

    response = await public_client.post(
        f"{settings.API_V1_STR}/nfc/locker-tap",
        json={"card_id": "RD-001", "locker_number": "A01"},
    )

    assert response.status_code == 200
    assert response.json()["action"] == "locker_released"


@pytest.mark.anyio
async def test_locker_tap_not_found(public_client: AsyncClient, mock_nfc_service: MagicMock):
    """POST /nfc/locker-tap returns 404 when locker doesn't exist."""
    mock_nfc_service.handle_locker_tap.side_effect = NotFoundError(message="Locker Z99 not found")

    response = await public_client.post(
        f"{settings.API_V1_STR}/nfc/locker-tap",
        json={"card_id": "RD-001", "locker_number": "Z99"},
    )

    assert response.status_code == 404


# ── X-API-Key authentication for GET /nfc/tap ────────────────────────────────


@pytest.mark.anyio
async def test_tap_passes_without_api_key_when_not_configured(
    public_client: AsyncClient, mock_nfc_service: MagicMock
):
    """GET /nfc/tap allows requests with no X-API-Key when NFC_READER_API_KEY is not set."""
    from app.schemas.nfc import TapResponse

    mock_nfc_service.handle_tap.return_value = TapResponse(action="welcome")

    original = settings.NFC_READER_API_KEY
    settings.NFC_READER_API_KEY = None  # type: ignore[assignment]
    try:
        response = await public_client.get(f"{settings.API_V1_STR}/nfc/tap?cid=RD-001")
        assert response.status_code == 200
    finally:
        settings.NFC_READER_API_KEY = original


@pytest.mark.anyio
async def test_tap_passes_with_correct_api_key(
    public_client: AsyncClient, mock_nfc_service: MagicMock
):
    """GET /nfc/tap allows requests with correct X-API-Key header."""
    from app.schemas.nfc import TapResponse

    mock_nfc_service.handle_tap.return_value = TapResponse(action="welcome")

    original = settings.NFC_READER_API_KEY
    settings.NFC_READER_API_KEY = "secret-reader-key-123"
    try:
        response = await public_client.get(
            f"{settings.API_V1_STR}/nfc/tap?cid=RD-001",
            headers={"X-API-Key": "secret-reader-key-123"},
        )
        assert response.status_code == 200
    finally:
        settings.NFC_READER_API_KEY = original


@pytest.mark.anyio
async def test_tap_rejects_wrong_api_key(
    public_client: AsyncClient, mock_nfc_service: MagicMock
):
    """GET /nfc/tap returns 403 when X-API-Key header is wrong."""
    original = settings.NFC_READER_API_KEY
    settings.NFC_READER_API_KEY = "secret-reader-key-123"
    try:
        response = await public_client.get(
            f"{settings.API_V1_STR}/nfc/tap?cid=RD-001",
            headers={"X-API-Key": "wrong-key"},
        )
        assert response.status_code == 403
    finally:
        settings.NFC_READER_API_KEY = original


@pytest.mark.anyio
async def test_tap_rejects_missing_api_key_when_configured(
    public_client: AsyncClient, mock_nfc_service: MagicMock
):
    """GET /nfc/tap returns 403 when X-API-Key is required but not sent."""
    original = settings.NFC_READER_API_KEY
    settings.NFC_READER_API_KEY = "secret-reader-key-123"
    try:
        response = await public_client.get(f"{settings.API_V1_STR}/nfc/tap?cid=RD-001")
        assert response.status_code == 403
    finally:
        settings.NFC_READER_API_KEY = original


# ── GET /nfc/card/{card_id} requires admin ────────────────────────────────────


@pytest.mark.anyio
async def test_get_card_status_as_admin(admin_client: AsyncClient, mock_nfc_service: MagicMock):
    """GET /nfc/card/{card_id} returns card info for admin."""
    from app.schemas.nfc import NfcCardRead

    card_id = "RD-TEST-001"
    mock_nfc_service.get_card_status.return_value = MagicMock(
        id=uuid4(),
        card_id=card_id,
        status="active",
        member_id=uuid4(),
        tier_at_issue="silver",
        issued_at=datetime.now(UTC),
        bound_at=datetime.now(UTC),
        last_tap_at=None,
        tap_count=0,
    )

    response = await admin_client.get(f"{settings.API_V1_STR}/nfc/card/{card_id}")
    assert response.status_code == 200


@pytest.mark.anyio
async def test_get_card_status_requires_auth(public_client: AsyncClient):
    """GET /nfc/card/{card_id} returns 401 without authentication."""
    response = await public_client.get(f"{settings.API_V1_STR}/nfc/card/RD-001")
    assert response.status_code == 401
