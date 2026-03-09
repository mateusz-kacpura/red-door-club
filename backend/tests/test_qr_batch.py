"""Unit tests for app/services/qr_batch.py — service layer and PDF generation."""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.qr_batch import generate_pdf, mark_converted

PDF_MAGIC = b"%PDF"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_batch(
    *,
    batch_id=None,
    promo_code="PRO-07",
    tier="silver",
    count=6,
    prefix="RD-",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=batch_id or uuid.uuid4(),
        promo_code=promo_code,
        tier=tier,
        count=count,
        prefix=prefix,
    )


def _make_code(pass_id: str, *, converted: bool = False) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        pass_id=pass_id,
        converted_at=datetime.now(timezone.utc) if converted else None,
        registered_user_id=uuid.uuid4() if converted else None,
    )


# ── generate_pdf ──────────────────────────────────────────────────────────────


class TestGeneratePdf:
    def test_returns_bytes(self):
        batch = _make_batch()
        codes = [_make_code(f"RD-{i:06d}") for i in range(1, 4)]

        result = generate_pdf(batch, codes, "http://localhost:3001")

        assert isinstance(result, bytes)

    def test_starts_with_pdf_magic_number(self):
        batch = _make_batch()
        codes = [_make_code("RD-000001")]

        result = generate_pdf(batch, codes, "http://localhost:3001")

        assert result[:4] == PDF_MAGIC

    def test_empty_codes_still_returns_valid_pdf(self):
        batch = _make_batch(count=0)
        result = generate_pdf(batch, [], "http://localhost:3001")

        assert isinstance(result, bytes)
        assert result[:4] == PDF_MAGIC

    def test_pdf_is_non_trivially_sized_with_codes(self):
        batch = _make_batch(count=3)
        codes = [_make_code(f"RD-{i:06d}") for i in range(1, 4)]

        result = generate_pdf(batch, codes, "http://localhost:3001")

        assert len(result) > 2048

    def test_no_promo_code_does_not_crash(self):
        batch = _make_batch(promo_code=None)
        codes = [_make_code("RD-000001")]

        result = generate_pdf(batch, codes, "http://localhost:3001")

        assert result[:4] == PDF_MAGIC

    def test_single_row_partial_grid(self):
        """4 codes → 2 full cells in first row + 1 in second row (partial row padding)."""
        batch = _make_batch(count=4)
        codes = [_make_code(f"RD-{i:06d}") for i in range(1, 5)]

        result = generate_pdf(batch, codes, "http://localhost:3001")

        assert result[:4] == PDF_MAGIC

    def test_full_three_column_grid(self):
        """9 codes → exactly 3 rows of 3."""
        batch = _make_batch(count=9)
        codes = [_make_code(f"RD-{i:06d}") for i in range(1, 10)]

        result = generate_pdf(batch, codes, "http://localhost:3001")

        assert result[:4] == PDF_MAGIC

    def test_custom_prefix_and_tier_in_output(self):
        """PDF should not raise regardless of tier or prefix value."""
        batch = _make_batch(prefix="VIP-", tier="obsidian", promo_code="OBS-2026")
        codes = [_make_code(f"VIP-{i:06d}") for i in range(1, 3)]

        result = generate_pdf(batch, codes, "https://thereddoor.club")

        assert result[:4] == PDF_MAGIC

    def test_large_batch_generates_pdf(self):
        batch = _make_batch(count=50)
        codes = [_make_code(f"RD-{i:06d}") for i in range(1, 51)]

        result = generate_pdf(batch, codes, "http://localhost:3001")

        assert isinstance(result, bytes)
        assert result[:4] == PDF_MAGIC
        # Large batch PDF should be meaningfully bigger than a trivial one
        tiny = generate_pdf(_make_batch(count=1), [_make_code("RD-000001")], "http://localhost:3001")
        assert len(result) > len(tiny)


# ── mark_converted ────────────────────────────────────────────────────────────


class TestMarkConverted:
    @pytest.fixture
    def anyio_backend(self) -> str:
        return "asyncio"

    @pytest.mark.anyio
    async def test_marks_code_converted_when_found(self):
        """mark_converted sets converted_at and registered_user_id."""
        code = SimpleNamespace(
            pass_id="RD-000001",
            converted_at=None,
            registered_user_id=None,
        )
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = code

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()

        user_id = uuid.uuid4()
        result = await mark_converted(db, "RD-000001", user_id)

        assert result is True
        assert code.converted_at is not None
        assert code.registered_user_id == user_id
        db.commit.assert_awaited_once()

    @pytest.mark.anyio
    async def test_returns_false_for_unknown_pass_id(self):
        """mark_converted returns False when pass_id not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        result = await mark_converted(db, "XX-999999", uuid.uuid4())

        assert result is False
        db.commit.assert_not_called()

    @pytest.mark.anyio
    async def test_returns_false_if_already_converted(self):
        """mark_converted returns False and does not re-convert."""
        code = SimpleNamespace(
            pass_id="RD-000001",
            converted_at=datetime.now(timezone.utc),
            registered_user_id=uuid.uuid4(),
        )
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = code

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        original_converted_at = code.converted_at
        result = await mark_converted(db, "RD-000001", uuid.uuid4())

        assert result is False
        # Timestamp should not be changed
        assert code.converted_at == original_converted_at
        db.commit.assert_not_called()


# ── create_batch (service) ────────────────────────────────────────────────────
#
# Note: create_batch uses SQLAlchemy's select().select_from(QrCode) to count
# existing codes, so we cannot patch the QrCode/QrBatch classes themselves
# (that would break SQLAlchemy's FROM clause validation).
# We mock only the db session operations and capture objects passed to add_all.


def _build_db_mock(existing_code_count: int = 0) -> AsyncMock:
    """Return a db mock where execute() returns `existing_code_count` for COUNT queries."""
    count_result = MagicMock()
    count_result.scalar.return_value = existing_code_count

    db = AsyncMock()
    db.execute = AsyncMock(return_value=count_result)
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock(side_effect=lambda obj: None)
    db.add = MagicMock()
    return db


class TestCreateBatch:
    @pytest.fixture
    def anyio_backend(self) -> str:
        return "asyncio"

    @pytest.mark.anyio
    async def test_generates_correct_number_of_codes(self):
        """create_batch inserts exactly N QrCode rows via add_all."""
        from app.services.qr_batch import create_batch

        db = _build_db_mock(existing_code_count=0)
        generated_codes: list = []
        db.add_all = MagicMock(side_effect=lambda items: generated_codes.extend(items))

        await create_batch(
            db,
            promoter_id=None,
            promo_code=None,
            tier="silver",
            count=5,
            prefix="RD-",
            notes=None,
            created_by=uuid.uuid4(),
        )

        assert len(generated_codes) == 5
        assert all(hasattr(c, "pass_id") for c in generated_codes)

    @pytest.mark.anyio
    async def test_pass_ids_follow_sequential_format(self):
        """Pass IDs should be formatted as '{prefix}{serial:06d}' starting at 1."""
        from app.services.qr_batch import create_batch

        db = _build_db_mock(existing_code_count=0)
        generated_codes: list = []
        db.add_all = MagicMock(side_effect=lambda items: generated_codes.extend(items))

        await create_batch(
            db,
            promoter_id=None,
            promo_code=None,
            tier="gold",
            count=3,
            prefix="VIP-",
            notes=None,
            created_by=uuid.uuid4(),
        )

        pass_ids = [c.pass_id for c in generated_codes]
        assert pass_ids == ["VIP-000001", "VIP-000002", "VIP-000003"]

    @pytest.mark.anyio
    async def test_serial_starts_after_existing_codes(self):
        """When existing codes exist, serials continue from the global count."""
        from app.services.qr_batch import create_batch

        # Simulate 10 existing codes in DB
        db = _build_db_mock(existing_code_count=10)
        generated_codes: list = []
        db.add_all = MagicMock(side_effect=lambda items: generated_codes.extend(items))

        await create_batch(
            db,
            promoter_id=None,
            promo_code=None,
            tier="silver",
            count=2,
            prefix="RD-",
            notes=None,
            created_by=uuid.uuid4(),
        )

        pass_ids = [c.pass_id for c in generated_codes]
        assert pass_ids == ["RD-000011", "RD-000012"]

    @pytest.mark.anyio
    async def test_commit_is_called_after_adding_codes(self):
        """create_batch commits the transaction."""
        from app.services.qr_batch import create_batch

        db = _build_db_mock(existing_code_count=0)
        db.add_all = MagicMock()

        await create_batch(
            db,
            promoter_id=None,
            promo_code=None,
            tier="silver",
            count=1,
            prefix="RD-",
            notes=None,
            created_by=uuid.uuid4(),
        )

        db.commit.assert_awaited_once()


# ── list_batches ──────────────────────────────────────────────────────────────


class TestListBatches:
    @pytest.fixture
    def anyio_backend(self) -> str:
        return "asyncio"

    @pytest.mark.anyio
    async def test_returns_empty_list_when_no_batches(self):
        from app.services.qr_batch import list_batches

        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []
        result_mock = MagicMock()
        result_mock.scalars.return_value = scalars_mock

        db = AsyncMock()
        db.execute = AsyncMock(return_value=result_mock)

        batches = await list_batches(db)

        assert batches == []

    @pytest.mark.anyio
    async def test_returns_list_of_batches(self):
        from app.services.qr_batch import list_batches

        b1 = SimpleNamespace(id=uuid.uuid4(), tier="silver")
        b2 = SimpleNamespace(id=uuid.uuid4(), tier="gold")

        scalars_mock = MagicMock()
        scalars_mock.all.return_value = [b1, b2]
        result_mock = MagicMock()
        result_mock.scalars.return_value = scalars_mock

        db = AsyncMock()
        db.execute = AsyncMock(return_value=result_mock)

        batches = await list_batches(db)

        assert len(batches) == 2
        assert batches[0] is b1
        assert batches[1] is b2
