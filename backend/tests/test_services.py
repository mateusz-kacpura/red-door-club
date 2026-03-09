
"""Tests for service layer."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import AlreadyExistsError, AuthenticationError, BadRequestError, NotFoundError
from app.schemas.user import UserCreate, UserUpdate
from app.services.user import UserService


class MockUser:
    """Mock user for testing."""

    def __init__(
        self,
        id=None,
        email="test@example.com",
        full_name="Test User",
        hashed_password="$2b$12$hashedpassword",
        is_active=True,
        is_superuser=False,
    ):
        self.id = id or uuid4()
        self.email = email
        self.full_name = full_name
        self.hashed_password = hashed_password
        self.is_active = is_active
        self.is_superuser = is_superuser


class TestUserServicePostgresql:
    """Tests for UserService with PostgreSQL."""

    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        """Create mock database session."""
        return AsyncMock()

    @pytest.fixture
    def user_service(self, mock_db: AsyncMock) -> UserService:
        """Create UserService instance with mock db."""
        return UserService(mock_db)

    @pytest.fixture
    def mock_user(self) -> MockUser:
        """Create a mock user."""
        return MockUser()

    @pytest.mark.anyio
    async def test_get_by_id_success(self, user_service: UserService, mock_user: MockUser):
        """Test getting user by ID successfully."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=mock_user)

            result = await user_service.get_by_id(mock_user.id)

            assert result == mock_user
            mock_repo.get_by_id.assert_called_once()

    @pytest.mark.anyio
    async def test_get_by_id_not_found(self, user_service: UserService):
        """Test getting non-existent user raises NotFoundError."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await user_service.get_by_id(uuid4())

    @pytest.mark.anyio
    async def test_get_by_email(self, user_service: UserService, mock_user: MockUser):
        """Test getting user by email."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_by_email = AsyncMock(return_value=mock_user)

            result = await user_service.get_by_email("test@example.com")

            assert result == mock_user

    @pytest.mark.anyio
    async def test_get_multi(self, user_service: UserService, mock_user: MockUser):
        """Test getting multiple users."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_multi = AsyncMock(return_value=[mock_user])

            result = await user_service.get_multi(skip=0, limit=10)

            assert len(result) == 1
            assert result[0] == mock_user

    @pytest.mark.anyio
    async def test_register_success(self, user_service: UserService, mock_user: MockUser):
        """Test registering a new user."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_by_email = AsyncMock(return_value=None)
            mock_repo.create = AsyncMock(return_value=mock_user)

            user_in = UserCreate(
                email="new@example.com",
                password="password123",
                full_name="New User",
            )
            result = await user_service.register(user_in)

            assert result == mock_user
            mock_repo.create.assert_called_once()

    @pytest.mark.anyio
    async def test_register_duplicate_email(self, user_service: UserService, mock_user: MockUser):
        """Test registering with existing email raises AlreadyExistsError."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_by_email = AsyncMock(return_value=mock_user)

            user_in = UserCreate(
                email="existing@example.com",
                password="password123",
                full_name="Test",
            )

            with pytest.raises(AlreadyExistsError):
                await user_service.register(user_in)

    @pytest.mark.anyio
    async def test_authenticate_success(self, user_service: UserService, mock_user: MockUser):
        """Test successful authentication."""
        with (
            patch("app.services.user.user_repo") as mock_repo,
            patch("app.services.user.verify_password", return_value=True),
        ):
            mock_repo.get_by_email = AsyncMock(return_value=mock_user)

            result = await user_service.authenticate("test@example.com", "password123")

            assert result == mock_user

    @pytest.mark.anyio
    async def test_authenticate_invalid_password(self, user_service: UserService, mock_user: MockUser):
        """Test authentication with wrong password."""
        with (
            patch("app.services.user.user_repo") as mock_repo,
            patch("app.services.user.verify_password", return_value=False),
        ):
            mock_repo.get_by_email = AsyncMock(return_value=mock_user)

            with pytest.raises(AuthenticationError):
                await user_service.authenticate("test@example.com", "wrongpassword")

    @pytest.mark.anyio
    async def test_authenticate_user_not_found(self, user_service: UserService):
        """Test authentication with non-existent user."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_by_email = AsyncMock(return_value=None)

            with pytest.raises(AuthenticationError):
                await user_service.authenticate("unknown@example.com", "password")

    @pytest.mark.anyio
    async def test_authenticate_inactive_user(self, user_service: UserService):
        """Test authentication with inactive user."""
        inactive_user = MockUser(is_active=False)
        with (
            patch("app.services.user.user_repo") as mock_repo,
            patch("app.services.user.verify_password", return_value=True),
        ):
            mock_repo.get_by_email = AsyncMock(return_value=inactive_user)

            with pytest.raises(AuthenticationError):
                await user_service.authenticate("test@example.com", "password")

    @pytest.mark.anyio
    async def test_update_success(self, user_service: UserService, mock_user: MockUser):
        """Test updating user."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=mock_user)
            mock_repo.update = AsyncMock(return_value=mock_user)

            user_update = UserUpdate(full_name="Updated Name")
            result = await user_service.update(mock_user.id, user_update)

            assert result == mock_user

    @pytest.mark.anyio
    async def test_update_with_password(self, user_service: UserService, mock_user: MockUser):
        """Test updating user with password change."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=mock_user)
            mock_repo.update = AsyncMock(return_value=mock_user)

            user_update = UserUpdate(password="newpassword123")
            result = await user_service.update(mock_user.id, user_update)

            assert result == mock_user
            # Verify hashed_password was passed to update
            call_args = mock_repo.update.call_args
            assert "hashed_password" in call_args[1]["update_data"]

    @pytest.mark.anyio
    async def test_delete_success(self, user_service: UserService, mock_user: MockUser):
        """Test deleting user."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.delete = AsyncMock(return_value=mock_user)

            result = await user_service.delete(mock_user.id)

            assert result == mock_user

    @pytest.mark.anyio
    async def test_delete_not_found(self, user_service: UserService):
        """Test deleting non-existent user."""
        with patch("app.services.user.user_repo") as mock_repo:
            mock_repo.delete = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await user_service.delete(uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# NfcService Tests
# ─────────────────────────────────────────────────────────────────────────────


class MockNfcCard:
    """Mock NFC card for testing."""

    def __init__(self, card_id="RD-NFC-001", status="unbound", member_id=None, tap_count=0):
        self.card_id = card_id
        self.status = status
        self.member_id = member_id
        self.tap_count = tap_count
        self.member = None


class TestNfcService:
    """Tests for NfcService."""

    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def nfc_service(self, mock_db: AsyncMock):
        from app.services.nfc import NfcService
        return NfcService(mock_db)

    @pytest.fixture
    def unbound_card(self) -> MockNfcCard:
        return MockNfcCard(card_id="RD-001", status="unbound")

    @pytest.fixture
    def active_card(self) -> MockNfcCard:
        return MockNfcCard(card_id="RD-002", status="active", member_id=uuid4(), tap_count=5)

    @pytest.fixture
    def suspended_card(self) -> MockNfcCard:
        return MockNfcCard(card_id="RD-003", status="suspended")

    @pytest.mark.anyio
    async def test_handle_tap_unbound_returns_setup(self, nfc_service, unbound_card):
        """handle_tap on unbound card returns setup action."""
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.get_card_by_card_id = AsyncMock(return_value=unbound_card)

            result = await nfc_service.handle_tap("RD-001")

            assert result.action == "setup"
            assert result.redirect_url is not None
            assert "RD-001" in result.redirect_url

    @pytest.mark.anyio
    async def test_handle_tap_active_returns_welcome(self, nfc_service, active_card):
        """handle_tap on active card logs event and returns welcome action."""
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.get_card_by_card_id = AsyncMock(return_value=active_card)
            mock_repo.log_tap_event = AsyncMock()
            mock_repo.update_card = AsyncMock()

            result = await nfc_service.handle_tap("RD-002", reader_id="R1", location="entrance")

            assert result.action == "welcome"
            mock_repo.log_tap_event.assert_called_once()
            call_kwargs = mock_repo.log_tap_event.call_args[1]
            assert call_kwargs["tap_type"] == "venue_entry"
            assert call_kwargs["location"] == "entrance"

    @pytest.mark.anyio
    async def test_handle_tap_suspended_returns_card_suspended(self, nfc_service, suspended_card):
        """handle_tap on suspended card returns card_suspended action."""
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.get_card_by_card_id = AsyncMock(return_value=suspended_card)

            result = await nfc_service.handle_tap("RD-003")

            assert result.action == "card_suspended"

    @pytest.mark.anyio
    async def test_handle_tap_card_not_found(self, nfc_service):
        """handle_tap raises NotFoundError for unknown card."""
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.get_card_by_card_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await nfc_service.handle_tap("UNKNOWN")

    @pytest.mark.anyio
    async def test_bind_card_success(self, nfc_service, unbound_card):
        """bind_card activates an unbound card for a member."""
        member_id = uuid4()
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.get_card_by_card_id = AsyncMock(return_value=unbound_card)
            mock_repo.update_card = AsyncMock()
            mock_repo.log_tap_event = AsyncMock()

            result = await nfc_service.bind_card("RD-001", member_id)

            assert result["status"] == "active"
            assert mock_repo.update_card.called
            # Verify profile_created tap was logged
            log_call_kwargs = mock_repo.log_tap_event.call_args[1]
            assert log_call_kwargs["tap_type"] == "profile_created"

    @pytest.mark.anyio
    async def test_bind_card_not_found(self, nfc_service):
        """bind_card raises NotFoundError for unknown card."""
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.get_card_by_card_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await nfc_service.bind_card("UNKNOWN", uuid4())

    @pytest.mark.anyio
    async def test_bind_card_already_active(self, nfc_service, active_card):
        """bind_card raises BadRequestError if card is not unbound."""
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.get_card_by_card_id = AsyncMock(return_value=active_card)

            with pytest.raises(BadRequestError):
                await nfc_service.bind_card("RD-002", uuid4())

    @pytest.mark.anyio
    async def test_suspend_card_success(self, nfc_service, active_card):
        """suspend_card sets card status to suspended."""
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.get_card_by_card_id = AsyncMock(return_value=active_card)
            mock_repo.update_card = AsyncMock()

            result = await nfc_service.suspend_card("RD-002")

            assert result["status"] == "suspended"
            update_kwargs = mock_repo.update_card.call_args[1]
            assert update_kwargs["status"] == "suspended"

    @pytest.mark.anyio
    async def test_batch_import(self, nfc_service):
        """batch_import passes items to repo and returns count."""
        from app.schemas.nfc import BatchImportItem

        cards = [
            BatchImportItem(card_id="RD-A01", tier_at_issue="silver"),
            BatchImportItem(card_id="RD-A02", tier_at_issue="gold"),
        ]
        with patch("app.services.nfc.nfc_repo") as mock_repo:
            mock_repo.batch_create_cards = AsyncMock(return_value=2)

            result = await nfc_service.batch_import(cards)

            assert result == 2
            mock_repo.batch_create_cards.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
# NfcService Phase 2 Tests
# ─────────────────────────────────────────────────────────────────────────────


class MockLocker:
    """Mock locker for testing."""

    def __init__(self, locker_number="A01", status="available", assigned_member_id=None):
        self.id = uuid4()
        self.locker_number = locker_number
        self.location = "main_floor"
        self.status = status
        self.assigned_member_id = assigned_member_id
        self.assigned_at = None
        self.released_at = None


class MockTab:
    """Mock tab for testing."""

    def __init__(self, total_amount=Decimal("0.00")):
        self.id = uuid4()
        self.member_id = uuid4()
        self.status = "open"
        self.opened_at = datetime.now(UTC)
        self.closed_at = None
        self.total_amount = total_amount
        self.items = []


class MockTapEvent:
    """Mock tap event for testing."""

    def __init__(self):
        self.id = uuid4()


class TestNfcServicePhase2:
    """Tests for NfcService Phase 2: handle_connection_tap, handle_payment_tap, handle_locker_tap."""

    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def nfc_service(self, mock_db: AsyncMock):
        from app.services.nfc import NfcService
        return NfcService(mock_db)

    @pytest.fixture
    def active_card_a(self) -> MockNfcCard:
        card = MockNfcCard(card_id="RD-A01", status="active", member_id=uuid4(), tap_count=5)
        card.member = MagicMock(full_name="Alice Smith")
        return card

    @pytest.fixture
    def active_card_b(self) -> MockNfcCard:
        card = MockNfcCard(card_id="RD-B02", status="active", member_id=uuid4(), tap_count=3)
        card.member = MagicMock(full_name="Bob Jones")
        return card

    # ── handle_connection_tap ─────────────────────────────────────────────────

    @pytest.mark.anyio
    async def test_connection_tap_success(self, nfc_service, active_card_a, active_card_b):
        """handle_connection_tap creates a connection between two members."""
        tap_event = MockTapEvent()

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.conn_repo") as mock_conn,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(side_effect=[active_card_a, active_card_b])
            mock_nfc.log_tap_event = AsyncMock(return_value=tap_event)
            mock_conn.exists = AsyncMock(return_value=False)
            mock_conn.create = AsyncMock()

            result = await nfc_service.handle_connection_tap("RD-A01", "RD-B02")

            assert result.action == "connection_made"
            assert "Bob Jones" in result.message
            mock_conn.create.assert_called_once()
            call_kwargs = mock_nfc.log_tap_event.call_args[1]
            assert call_kwargs["tap_type"] == "connection_tap"

    @pytest.mark.anyio
    async def test_connection_tap_card_a_not_found(self, nfc_service):
        """handle_connection_tap raises NotFoundError when card_a is unknown."""
        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.conn_repo"),
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await nfc_service.handle_connection_tap("UNKNOWN", "RD-B02")

    @pytest.mark.anyio
    async def test_connection_tap_card_b_not_found(self, nfc_service, active_card_a):
        """handle_connection_tap raises NotFoundError when card_b is unknown."""
        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.conn_repo"),
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(side_effect=[active_card_a, None])

            with pytest.raises(NotFoundError):
                await nfc_service.handle_connection_tap("RD-A01", "UNKNOWN")

    @pytest.mark.anyio
    async def test_connection_tap_card_not_active(self, nfc_service, active_card_b):
        """handle_connection_tap raises BadRequestError when card_a is not active."""
        suspended_card = MockNfcCard(card_id="RD-X", status="suspended", member_id=uuid4())

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.conn_repo"),
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(side_effect=[suspended_card, active_card_b])

            with pytest.raises(BadRequestError):
                await nfc_service.handle_connection_tap("RD-X", "RD-B02")

    @pytest.mark.anyio
    async def test_connection_tap_already_connected(self, nfc_service, active_card_a, active_card_b):
        """handle_connection_tap raises AlreadyExistsError when members are already connected."""
        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.conn_repo") as mock_conn,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(side_effect=[active_card_a, active_card_b])
            mock_conn.exists = AsyncMock(return_value=True)

            with pytest.raises(AlreadyExistsError):
                await nfc_service.handle_connection_tap("RD-A01", "RD-B02")

    # ── handle_payment_tap ────────────────────────────────────────────────────

    @pytest.mark.anyio
    async def test_payment_tap_success_existing_tab(self, nfc_service, active_card_a):
        """handle_payment_tap adds item to an existing open tab."""
        existing_tab = MockTab(total_amount=Decimal("500.00"))
        tap_event = MockTapEvent()

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.tab_repo") as mock_tab,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=active_card_a)
            mock_nfc.log_tap_event = AsyncMock(return_value=tap_event)
            mock_tab.get_open_tab = AsyncMock(return_value=existing_tab)
            mock_tab.create_tab = AsyncMock()
            mock_tab.add_item = AsyncMock()

            result = await nfc_service.handle_payment_tap(
                "RD-A01", Decimal("200.00"), "Whisky Sour"
            )

            assert result.action == "payment_added"
            assert "Whisky Sour" in result.message
            mock_tab.create_tab.assert_not_called()
            mock_tab.add_item.assert_called_once()
            call_kwargs = mock_nfc.log_tap_event.call_args[1]
            assert call_kwargs["tap_type"] == "payment_tap"

    @pytest.mark.anyio
    async def test_payment_tap_creates_tab_if_none(self, nfc_service, active_card_a):
        """handle_payment_tap auto-creates a tab when none exists."""
        new_tab = MockTab(total_amount=Decimal("0.00"))
        tap_event = MockTapEvent()

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.tab_repo") as mock_tab,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=active_card_a)
            mock_nfc.log_tap_event = AsyncMock(return_value=tap_event)
            mock_tab.get_open_tab = AsyncMock(return_value=None)
            mock_tab.create_tab = AsyncMock(return_value=new_tab)
            mock_tab.add_item = AsyncMock()

            result = await nfc_service.handle_payment_tap(
                "RD-A01", Decimal("350.00"), "Champagne"
            )

            assert result.action == "payment_added"
            mock_tab.create_tab.assert_called_once()
            mock_tab.add_item.assert_called_once()

    @pytest.mark.anyio
    async def test_payment_tap_card_not_found(self, nfc_service):
        """handle_payment_tap raises NotFoundError for unknown card."""
        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.tab_repo"),
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await nfc_service.handle_payment_tap("UNKNOWN", Decimal("100.00"), "Drink")

    @pytest.mark.anyio
    async def test_payment_tap_card_not_active(self, nfc_service):
        """handle_payment_tap raises BadRequestError for inactive card."""
        suspended = MockNfcCard(card_id="RD-S", status="suspended", member_id=uuid4())

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.tab_repo"),
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=suspended)

            with pytest.raises(BadRequestError):
                await nfc_service.handle_payment_tap("RD-S", Decimal("100.00"), "Drink")

    # ── handle_locker_tap ─────────────────────────────────────────────────────

    @pytest.mark.anyio
    async def test_locker_tap_assign(self, nfc_service, active_card_a):
        """handle_locker_tap assigns an available locker when member has none."""
        available_locker = MockLocker(locker_number="A01", status="available")
        tap_event = MockTapEvent()

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.locker_repo") as mock_locker,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=active_card_a)
            mock_nfc.log_tap_event = AsyncMock(return_value=tap_event)
            mock_locker.get_by_number = AsyncMock(return_value=available_locker)
            mock_locker.get_by_member = AsyncMock(return_value=None)
            mock_locker.assign = AsyncMock()

            result = await nfc_service.handle_locker_tap("RD-A01", "A01")

            assert result.action == "locker_assigned"
            assert "A01" in result.message
            mock_locker.assign.assert_called_once()

    @pytest.mark.anyio
    async def test_locker_tap_release(self, nfc_service, active_card_a):
        """handle_locker_tap releases a locker when member taps same locker again."""
        current_locker = MockLocker(locker_number="A01", status="occupied",
                                    assigned_member_id=active_card_a.member_id)
        target_locker = MockLocker(locker_number="A01", status="occupied")
        tap_event = MockTapEvent()

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.locker_repo") as mock_locker,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=active_card_a)
            mock_nfc.log_tap_event = AsyncMock(return_value=tap_event)
            mock_locker.get_by_number = AsyncMock(return_value=target_locker)
            mock_locker.get_by_member = AsyncMock(return_value=current_locker)
            mock_locker.release = AsyncMock()

            result = await nfc_service.handle_locker_tap("RD-A01", "A01")

            assert result.action == "locker_released"
            mock_locker.release.assert_called_once()

    @pytest.mark.anyio
    async def test_locker_tap_already_assigned_different(self, nfc_service, active_card_a):
        """handle_locker_tap returns locker_already_assigned when member has a different locker."""
        current_locker = MockLocker(locker_number="B05", status="occupied",
                                    assigned_member_id=active_card_a.member_id)
        target_locker = MockLocker(locker_number="A01", status="available")
        tap_event = MockTapEvent()

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.locker_repo") as mock_locker,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=active_card_a)
            mock_nfc.log_tap_event = AsyncMock(return_value=tap_event)
            mock_locker.get_by_number = AsyncMock(return_value=target_locker)
            mock_locker.get_by_member = AsyncMock(return_value=current_locker)

            result = await nfc_service.handle_locker_tap("RD-A01", "A01")

            assert result.action == "locker_already_assigned"
            assert "B05" in result.message

    @pytest.mark.anyio
    async def test_locker_tap_occupied(self, nfc_service, active_card_a):
        """handle_locker_tap returns locker_occupied when locker is taken by someone else."""
        occupied_locker = MockLocker(locker_number="A01", status="occupied",
                                     assigned_member_id=uuid4())
        tap_event = MockTapEvent()

        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.locker_repo") as mock_locker,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=active_card_a)
            mock_nfc.log_tap_event = AsyncMock(return_value=tap_event)
            mock_locker.get_by_number = AsyncMock(return_value=occupied_locker)
            mock_locker.get_by_member = AsyncMock(return_value=None)

            result = await nfc_service.handle_locker_tap("RD-A01", "A01")

            assert result.action == "locker_occupied"

    @pytest.mark.anyio
    async def test_locker_tap_locker_not_found(self, nfc_service, active_card_a):
        """handle_locker_tap raises NotFoundError for unknown locker number."""
        with (
            patch("app.services.nfc.nfc_repo") as mock_nfc,
            patch("app.services.nfc.locker_repo") as mock_locker,
        ):
            mock_nfc.get_card_by_card_id = AsyncMock(return_value=active_card_a)
            mock_locker.get_by_number = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await nfc_service.handle_locker_tap("RD-A01", "Z99")


# ─────────────────────────────────────────────────────────────────────────────
# EventService Tests
# ─────────────────────────────────────────────────────────────────────────────


class MockEvent:
    """Mock event for testing."""

    def __init__(
        self,
        event_id=None,
        title="Test Event",
        status="published",
        target_segments=None,
        capacity=50,
        min_tier=None,
    ):
        self.id = event_id or uuid4()
        self.title = title
        self.description = None
        self.event_type = "mixer"
        self.target_segments = target_segments or []
        self.capacity = capacity
        self.ticket_price = Decimal("0.00")
        self.starts_at = datetime.now(UTC)
        self.ends_at = None
        self.status = status
        self.min_tier = min_tier
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)
        self.attendees = []


class MockMember:
    """Mock member for EventService tests."""

    def __init__(self, tier="silver", segments=None):
        self.id = uuid4()
        self.email = "member@example.com"
        self.tier = tier
        self.segment_groups = segments or []
        self.is_active = True


class TestEventService:
    """Tests for EventService."""

    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def event_service(self, mock_db: AsyncMock):
        from app.services.event import EventService
        return EventService(mock_db)

    @pytest.mark.anyio
    async def test_list_events_empty(self, event_service):
        """list_events returns empty list when no published events."""
        member = MockMember()
        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_published = AsyncMock(return_value=[])

            result = await event_service.list_events(member)

            assert result == []

    @pytest.mark.anyio
    async def test_list_events_match_score_computed(self, event_service):
        """list_events computes match score based on segment overlap."""
        member = MockMember(segments=["Finance & Investors", "Tech & Founders"])
        event = MockEvent(target_segments=["Finance & Investors"])

        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_published = AsyncMock(return_value=[event])
            mock_repo.get_rsvp_count = AsyncMock(return_value=0)
            mock_repo.is_rsvped = AsyncMock(return_value=False)

            result = await event_service.list_events(member)

            assert len(result) == 1
            assert result[0].match_score == 1.0  # 1/1 overlap

    @pytest.mark.anyio
    async def test_list_events_filtered_by_tier(self, event_service):
        """list_events excludes events above member's tier."""
        member = MockMember(tier="silver")
        # Event requires gold — silver member should not see it
        event = MockEvent(min_tier="gold")

        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_published = AsyncMock(return_value=[event])

            result = await event_service.list_events(member)

            assert result == []

    @pytest.mark.anyio
    async def test_list_events_sorted_by_match_score(self, event_service):
        """list_events returns events sorted by match_score descending."""
        member = MockMember(segments=["Finance & Investors"])
        event_high = MockEvent(event_id=uuid4(), target_segments=["Finance & Investors"])
        event_low = MockEvent(event_id=uuid4(), target_segments=["Tech & Founders"])

        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_published = AsyncMock(return_value=[event_low, event_high])
            mock_repo.get_rsvp_count = AsyncMock(return_value=0)
            mock_repo.is_rsvped = AsyncMock(return_value=False)

            result = await event_service.list_events(member)

            assert result[0].match_score >= result[1].match_score

    @pytest.mark.anyio
    async def test_get_event_success(self, event_service):
        """get_event returns event read schema."""
        event = MockEvent()
        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=event)
            mock_repo.get_rsvp_count = AsyncMock(return_value=3)

            result = await event_service.get_event(event.id)

            assert result.title == "Test Event"
            assert result.rsvp_count == 3

    @pytest.mark.anyio
    async def test_get_event_not_found(self, event_service):
        """get_event raises NotFoundError for unknown ID."""
        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await event_service.get_event(uuid4())

    @pytest.mark.anyio
    async def test_rsvp_success(self, event_service):
        """rsvp adds member to event attendees."""
        event = MockEvent(capacity=50)
        member_id = uuid4()

        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=event)
            mock_repo.get_rsvp_count = AsyncMock(return_value=10)
            mock_repo.add_rsvp = AsyncMock(return_value=True)

            result = await event_service.rsvp(event.id, member_id)

            assert result is True
            mock_repo.add_rsvp.assert_called_once_with(
                event_service.db, event.id, member_id
            )

    @pytest.mark.anyio
    async def test_rsvp_event_not_published(self, event_service):
        """rsvp raises BadRequestError for non-published event."""
        event = MockEvent(status="draft")

        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=event)

            with pytest.raises(BadRequestError, match="Cannot RSVP"):
                await event_service.rsvp(event.id, uuid4())

    @pytest.mark.anyio
    async def test_rsvp_event_at_capacity(self, event_service):
        """rsvp raises BadRequestError when event is at full capacity."""
        event = MockEvent(capacity=5)

        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=event)
            mock_repo.get_rsvp_count = AsyncMock(return_value=5)

            with pytest.raises(BadRequestError, match="capacity"):
                await event_service.rsvp(event.id, uuid4())

    @pytest.mark.anyio
    async def test_cancel_rsvp(self, event_service):
        """cancel_rsvp removes member from event."""
        event = MockEvent()

        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=event)
            mock_repo.remove_rsvp = AsyncMock(return_value=True)

            result = await event_service.cancel_rsvp(event.id, uuid4())

            assert result is True

    @pytest.mark.anyio
    async def test_create_event(self, event_service):
        """create_event delegates to event_repo and returns EventRead."""
        from app.schemas.event import EventCreate

        new_event = MockEvent(title="VIP Mixer")
        event_in = EventCreate(
            title="VIP Mixer",
            event_type="mixer",
            capacity=30,
            starts_at=datetime.now(UTC),
        )

        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.create = AsyncMock(return_value=new_event)

            result = await event_service.create_event(event_in)

            assert result.title == "VIP Mixer"
            mock_repo.create.assert_called_once()

    @pytest.mark.anyio
    async def test_checkin_logs_tap_event(self, event_service):
        """checkin logs event_checkin tap when card_id is provided."""
        event = MockEvent()
        member_id = uuid4()
        card_id = "RD-NFC-001"

        with (
            patch("app.services.event.event_repo") as mock_repo,
            patch("app.services.event.nfc_repo") as mock_nfc,
        ):
            mock_repo.get_by_id = AsyncMock(return_value=event)
            mock_nfc.log_tap_event = AsyncMock()

            result = await event_service.checkin(event.id, member_id, card_id=card_id)

            assert result is True
            mock_nfc.log_tap_event.assert_called_once()
            call_kwargs = mock_nfc.log_tap_event.call_args[1]
            assert call_kwargs["tap_type"] == "event_checkin"
            assert call_kwargs["member_id"] == member_id

    @pytest.mark.anyio
    async def test_checkin_without_card_id(self, event_service):
        """checkin succeeds without card_id and skips tap logging."""
        event = MockEvent()

        with (
            patch("app.services.event.event_repo") as mock_repo,
            patch("app.services.event.nfc_repo") as mock_nfc,
        ):
            mock_repo.get_by_id = AsyncMock(return_value=event)

            result = await event_service.checkin(event.id, uuid4())

            assert result is True
            mock_nfc.log_tap_event.assert_not_called()

    @pytest.mark.anyio
    async def test_checkin_event_not_found(self, event_service):
        """checkin raises NotFoundError for unknown event."""
        with patch("app.services.event.event_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await event_service.checkin(uuid4(), uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# Utility: _compute_match_score Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestComputeMatchScore:
    """Tests for the match score computation function."""

    def test_perfect_match(self):
        from app.services.event import _compute_match_score

        event = MockEvent(target_segments=["Finance & Investors"])
        member = MockMember(segments=["Finance & Investors"])
        assert _compute_match_score(event, member) == 1.0

    def test_partial_match(self):
        from app.services.event import _compute_match_score

        event = MockEvent(target_segments=["Finance & Investors", "Tech & Founders"])
        member = MockMember(segments=["Finance & Investors"])
        assert _compute_match_score(event, member) == 0.5

    def test_no_match(self):
        from app.services.event import _compute_match_score

        event = MockEvent(target_segments=["Real Estate"])
        member = MockMember(segments=["Finance & Investors"])
        assert _compute_match_score(event, member) == 0.0

    def test_no_target_segments_returns_default(self):
        from app.services.event import _compute_match_score

        event = MockEvent(target_segments=[])
        member = MockMember(segments=["Finance & Investors"])
        assert _compute_match_score(event, member) == 0.5

    def test_member_no_segments(self):
        from app.services.event import _compute_match_score

        event = MockEvent(target_segments=["Finance & Investors"])
        member = MockMember(segments=[])
        assert _compute_match_score(event, member) == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# AdminService Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestAdminService:
    """Tests for AdminService."""

    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        db = AsyncMock()
        db.scalar = AsyncMock(return_value=0)
        db.get = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def admin_service(self, mock_db: AsyncMock):
        from app.services.admin import AdminService
        return AdminService(mock_db)

    @pytest.mark.anyio
    async def test_get_floor_view_empty(self, admin_service):
        """get_floor_view returns empty list when no recent venue entries."""
        with patch("app.services.admin.nfc_repo") as mock_repo:
            mock_repo.get_recent_venue_entries = AsyncMock(return_value=[])

            result = await admin_service.get_floor_view()

            assert result == []

    @pytest.mark.anyio
    async def test_get_floor_view_deduplicates_by_member(self, admin_service, mock_db):
        """get_floor_view deduplicates multiple taps by same member."""
        member_id = uuid4()
        now = datetime.now(UTC)

        tap1 = MagicMock()
        tap1.member_id = member_id
        tap1.tapped_at = now
        tap1.location = "entrance"

        tap2 = MagicMock()
        tap2.member_id = member_id  # same member
        tap2.tapped_at = now
        tap2.location = "bar"

        mock_user = MagicMock()
        mock_user.full_name = "Jane Doe"
        mock_user.company_name = "FinCo"
        mock_user.tier = "gold"
        mock_db.get = AsyncMock(return_value=mock_user)

        with patch("app.services.admin.nfc_repo") as mock_repo:
            mock_repo.get_recent_venue_entries = AsyncMock(return_value=[tap1, tap2])

            result = await admin_service.get_floor_view()

            # Should return only 1 entry despite 2 taps
            assert len(result) == 1
            assert result[0]["full_name"] == "Jane Doe"

    @pytest.mark.anyio
    async def test_get_analytics_returns_kpis(self, admin_service, mock_db):
        """get_analytics returns a dict with required KPI keys."""
        mock_db.scalar = AsyncMock(side_effect=[42, 10, 5, 3])

        result = await admin_service.get_analytics()

        assert "total_members" in result
        assert "total_prospects" in result
        assert "active_today" in result
        assert "events_this_week" in result

    @pytest.mark.anyio
    async def test_get_prep_checklist(self, admin_service):
        """get_prep_checklist delegates to sr_repo."""
        with patch("app.services.admin.sr_repo") as mock_repo:
            mock_repo.get_pending_today = AsyncMock(return_value=[])

            result = await admin_service.get_prep_checklist()

            assert result == []
            mock_repo.get_pending_today.assert_called_once()

    @pytest.mark.anyio
    async def test_complete_checklist_item_success(self, admin_service):
        """complete_checklist_item marks request as completed."""
        request_id = uuid4()
        mock_req = MagicMock()

        with patch("app.services.admin.sr_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=mock_req)
            mock_repo.update = AsyncMock()

            result = await admin_service.complete_checklist_item(request_id)

            assert result["status"] == "completed"
            update_args = mock_repo.update.call_args[0]
            assert update_args[2] == {"status": "completed"}

    @pytest.mark.anyio
    async def test_complete_checklist_item_not_found(self, admin_service):
        """complete_checklist_item raises NotFoundError for missing item."""
        with patch("app.services.admin.sr_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await admin_service.complete_checklist_item(uuid4())
