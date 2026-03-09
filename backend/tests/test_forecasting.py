"""Unit tests for Phase 6B: app/services/forecasting.py.

Covers ForecastingEngine:
  - predict_event_attendance (confidence, baseline, weekday/price/days factors, clamping)
  - get_peak_hours (heatmap structure, busiest/quietest slot)
  - get_segment_demand (per-segment fill rates, trending_up)
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.services.forecasting import ForecastingEngine, WEEKDAY_FACTOR


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_event(
    *,
    id=None,
    title="Test Event",
    event_type="mixer",
    capacity=100,
    ticket_price=Decimal("0.00"),
    target_segments=None,
    starts_at=None,
    status="published",
    attendees=None,
):
    """Build a minimal mock Event object."""
    evt = MagicMock()
    evt.id = id or uuid4()
    evt.title = title
    evt.event_type = event_type
    evt.capacity = capacity
    evt.ticket_price = ticket_price
    evt.target_segments = target_segments or []
    evt.starts_at = starts_at or datetime.now(timezone.utc) + timedelta(days=20)
    evt.status = status
    # attendees is a list (len() is called on it)
    evt.attendees = attendees if attendees is not None else []
    return evt


def _make_past_event(*, attendees_count=60, capacity=100, event_type="mixer",
                     target_segments=None):
    """Completed past event with attendees list of given length."""
    evt = _make_event(
        event_type=event_type,
        capacity=capacity,
        target_segments=target_segments or [],
        starts_at=datetime.now(timezone.utc) - timedelta(days=30),
        status="completed",
    )
    evt.attendees = [MagicMock() for _ in range(attendees_count)]
    return evt


def _db_execute_scalars(items):
    mock = MagicMock()
    mock.scalars.return_value.all.return_value = items
    return mock


def _db_execute_fetchall(rows):
    mock = MagicMock()
    mock.fetchall.return_value = rows
    return mock


# ── predict_event_attendance ──────────────────────────────────────────────────


class TestPredictEventAttendance:
    @pytest.mark.anyio
    async def test_returns_required_keys(self):
        event = _make_event(capacity=50)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([]))

        result = await ForecastingEngine.predict_event_attendance(db, event)

        required = {
            "event_id", "event_title", "predicted_attendees",
            "actual_capacity", "capacity_utilization_pct",
            "confidence", "similar_events_count", "recommendation",
        }
        assert required.issubset(result.keys())

    @pytest.mark.anyio
    async def test_low_confidence_and_baseline_60pct_when_no_similar_events(self):
        """No similar events → baseline = capacity × 0.6, confidence = low."""
        event = _make_event(
            capacity=100,
            # Starts in 20 days (factor 1.0), free (factor 1.0), Saturday
            starts_at=datetime.now(timezone.utc) + timedelta(days=20),
        )
        # Saturday
        saturday = datetime.now(timezone.utc) + timedelta(days=20)
        while saturday.weekday() != 5:  # 5 = Saturday
            saturday += timedelta(days=1)
        event.starts_at = saturday

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([]))

        result = await ForecastingEngine.predict_event_attendance(db, event)

        assert result["confidence"] == "low"
        assert result["similar_events_count"] == 0
        # baseline=60, weekday_factor=1.5 → 60×1.5=90
        assert result["predicted_attendees"] == 90

    @pytest.mark.anyio
    async def test_uses_mean_for_one_similar_event(self):
        """1 similar event → mean used, confidence=low."""
        past = _make_past_event(attendees_count=40, capacity=100, event_type="mixer")
        event = _make_event(
            capacity=100,
            event_type="mixer",
            # Use Thursday (factor 1.0), ≥14 days ahead, free
            starts_at=_next_weekday(3),  # 3=Thursday
        )

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([past]))

        result = await ForecastingEngine.predict_event_attendance(db, event)

        assert result["similar_events_count"] == 1
        assert result["confidence"] == "low"
        # baseline = mean([40]) = 40.0, factors = 1.0×1.0×1.0 = 1.0 → predicted=40
        assert result["predicted_attendees"] == 40

    @pytest.mark.anyio
    async def test_uses_median_for_three_similar_events(self):
        """≥3 similar events → median used, confidence=medium."""
        past_events = [
            _make_past_event(attendees_count=c, event_type="mixer")
            for c in [20, 60, 80]
        ]
        event = _make_event(
            capacity=100,
            event_type="mixer",
            starts_at=_next_weekday(3),   # Thursday = 1.0
        )

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars(past_events))

        result = await ForecastingEngine.predict_event_attendance(db, event)

        assert result["similar_events_count"] == 3
        assert result["confidence"] == "medium"
        # median([20, 60, 80]) = 60 → 60×1.0=60
        assert result["predicted_attendees"] == 60

    @pytest.mark.anyio
    async def test_high_confidence_for_five_similar_events(self):
        past_events = [
            _make_past_event(attendees_count=50, event_type="mixer")
            for _ in range(5)
        ]
        event = _make_event(
            capacity=100,
            event_type="mixer",
            starts_at=_next_weekday(3),
        )

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars(past_events))

        result = await ForecastingEngine.predict_event_attendance(db, event)

        assert result["confidence"] == "high"

    @pytest.mark.anyio
    async def test_saturday_weekday_factor_is_1_5(self):
        """Saturday (weekday=5) multiplier = 1.5."""
        assert WEEKDAY_FACTOR[5] == 1.5

        past = _make_past_event(attendees_count=40, event_type="gala")
        saturday = _next_weekday(5)
        event = _make_event(capacity=100, event_type="gala", starts_at=saturday)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([past]))

        result = await ForecastingEngine.predict_event_attendance(db, event)
        # baseline=40, saturday=1.5, free=1.0, ≥14 days=1.0
        assert result["predicted_attendees"] == 60

    @pytest.mark.anyio
    async def test_monday_weekday_factor_is_0_7(self):
        """Monday (weekday=0) multiplier = 0.7."""
        assert WEEKDAY_FACTOR[0] == 0.7

        past = _make_past_event(attendees_count=100, event_type="gala")
        monday = _next_weekday(0)
        event = _make_event(capacity=200, event_type="gala", starts_at=monday)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([past]))

        result = await ForecastingEngine.predict_event_attendance(db, event)
        # baseline=100, monday=0.7, free=1.0, ≥14 days=1.0 → 70
        assert result["predicted_attendees"] == 70

    @pytest.mark.anyio
    async def test_paid_event_has_0_8_price_factor(self):
        """Paid events (ticket_price > 0) get price_factor = 0.8."""
        past = _make_past_event(attendees_count=100, event_type="dinner")
        event = _make_event(
            capacity=200,
            event_type="dinner",
            ticket_price=Decimal("500.00"),
            starts_at=_next_weekday(3),  # Thursday = 1.0
        )

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([past]))

        result = await ForecastingEngine.predict_event_attendance(db, event)
        # baseline=100, thursday=1.0, paid=0.8, ≥14 days=1.0 → 80
        assert result["predicted_attendees"] == 80

    @pytest.mark.anyio
    async def test_days_ahead_factor_under_7_days(self):
        """Events starting in < 7 days get days_ahead_factor = 0.8."""
        past = _make_past_event(attendees_count=100, event_type="mixer")
        # starts in 3 days
        starts_at = datetime.now(timezone.utc) + timedelta(days=3)
        event = _make_event(capacity=200, event_type="mixer", starts_at=starts_at)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([past]))

        result = await ForecastingEngine.predict_event_attendance(db, event)
        weekday = starts_at.weekday()
        wf = WEEKDAY_FACTOR[weekday]
        expected = int(100 * wf * 1.0 * 0.8)
        assert result["predicted_attendees"] == min(expected, 200)

    @pytest.mark.anyio
    async def test_predicted_never_exceeds_capacity(self):
        """predicted_attendees must be ≤ event.capacity."""
        # Very high attendance past events
        past_events = [
            _make_past_event(attendees_count=200, event_type="gala", capacity=200)
            for _ in range(5)
        ]
        saturday = _next_weekday(5)  # factor 1.5
        event = _make_event(capacity=100, event_type="gala", starts_at=saturday)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars(past_events))

        result = await ForecastingEngine.predict_event_attendance(db, event)
        assert result["predicted_attendees"] <= event.capacity

    @pytest.mark.anyio
    async def test_predicted_never_negative(self):
        """predicted_attendees must be ≥ 0."""
        event = _make_event(capacity=100, starts_at=datetime.now(timezone.utc) + timedelta(days=3))

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([]))

        result = await ForecastingEngine.predict_event_attendance(db, event)
        assert result["predicted_attendees"] >= 0

    @pytest.mark.anyio
    async def test_capacity_utilization_pct_matches_prediction(self):
        past = _make_past_event(attendees_count=50, event_type="mixer")
        event = _make_event(capacity=100, event_type="mixer", starts_at=_next_weekday(3))

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([past]))

        result = await ForecastingEngine.predict_event_attendance(db, event)
        expected_pct = round(result["predicted_attendees"] / 100 * 100, 1)
        assert result["capacity_utilization_pct"] == expected_pct


# ── get_peak_hours ────────────────────────────────────────────────────────────


class TestGetPeakHours:
    @pytest.mark.anyio
    async def test_returns_required_keys(self):
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_fetchall([]))

        result = await ForecastingEngine.get_peak_hours(db)

        assert "heatmap" in result
        assert "busiest_slot" in result
        assert "quietest_slot" in result

    @pytest.mark.anyio
    async def test_heatmap_is_7_rows_24_cols(self):
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_fetchall([]))

        result = await ForecastingEngine.get_peak_hours(db)

        assert len(result["heatmap"]) == 7
        for row in result["heatmap"]:
            assert len(row) == 24

    @pytest.mark.anyio
    async def test_heatmap_all_zeros_when_no_events(self):
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_fetchall([]))

        result = await ForecastingEngine.get_peak_hours(db)

        for row in result["heatmap"]:
            assert all(v == 0 for v in row)

    @pytest.mark.anyio
    async def test_quietest_slot_na_when_no_data(self):
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_fetchall([]))

        result = await ForecastingEngine.get_peak_hours(db)

        assert result["quietest_slot"]["weekday_name"] == "N/A"

    @pytest.mark.anyio
    async def test_heatmap_fills_correct_cell(self):
        """PostgreSQL DOW 6=Saturday → py_dow = (6-1)%7 = 5 (Saturday), hr=21, cnt=10."""
        # pg_dow=6 (Sat in pg), hr=21, cnt=10
        row = (6.0, 21.0, 10.0)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_fetchall([row]))

        result = await ForecastingEngine.get_peak_hours(db)

        py_dow = (6 - 1) % 7  # = 5 = Saturday
        assert result["heatmap"][py_dow][21] == 10

    @pytest.mark.anyio
    async def test_sunday_conversion(self):
        """PostgreSQL DOW 0=Sunday → py_dow = (0-1)%7 = 6 (Sunday)."""
        row = (0.0, 12.0, 5.0)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_fetchall([row]))

        result = await ForecastingEngine.get_peak_hours(db)

        py_dow = (0 - 1) % 7  # = 6 = Sunday
        assert result["heatmap"][py_dow][12] == 5

    @pytest.mark.anyio
    async def test_busiest_slot_identified(self):
        """The cell with the highest count is the busiest slot."""
        # Two rows: Saturday 21h=10, Friday 20h=5
        rows = [
            (6.0, 21.0, 10.0),  # Saturday, 21h, 10 taps
            (5.0, 20.0, 5.0),   # Friday, 20h, 5 taps
        ]

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_fetchall(rows))

        result = await ForecastingEngine.get_peak_hours(db)

        assert result["busiest_slot"]["count"] == 10
        assert result["busiest_slot"]["weekday_name"] == "Saturday"
        assert result["busiest_slot"]["hour"] == 21


# ── get_segment_demand ────────────────────────────────────────────────────────


class TestGetSegmentDemand:
    @pytest.mark.anyio
    async def test_returns_empty_when_no_events(self):
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([]))

        result = await ForecastingEngine.get_segment_demand(db)
        assert result == []

    @pytest.mark.anyio
    async def test_calculates_avg_fill_rate(self):
        """fill_rate = attendees / capacity; avg across events of that segment."""
        e1 = _make_past_event(attendees_count=60, capacity=100, target_segments=["Tech & Founders"])
        e2 = _make_past_event(attendees_count=80, capacity=100, target_segments=["Tech & Founders"])

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([e1, e2]))

        result = await ForecastingEngine.get_segment_demand(db)

        assert len(result) == 1
        assert result[0]["segment"] == "Tech & Founders"
        # fill rates: 0.6, 0.8 → avg = 0.7
        assert abs(result[0]["avg_fill_rate"] - 0.7) < 0.001

    @pytest.mark.anyio
    async def test_trending_up_when_recent_avg_exceeds_early_avg(self):
        """With ≥4 events, trending_up = True when later half > first half."""
        events = [
            _make_past_event(attendees_count=c, capacity=100, target_segments=["Finance & Investors"])
            for c in [20, 30, 60, 80]   # early avg=25, late avg=70 → trending up
        ]

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars(events))

        result = await ForecastingEngine.get_segment_demand(db)

        seg = next(r for r in result if r["segment"] == "Finance & Investors")
        assert seg["trending_up"] is True

    @pytest.mark.anyio
    async def test_trending_down_when_recent_avg_below_early_avg(self):
        events = [
            _make_past_event(attendees_count=c, capacity=100, target_segments=["Real Estate"])
            for c in [80, 70, 30, 20]   # early avg=75, late avg=25 → trending down
        ]

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars(events))

        result = await ForecastingEngine.get_segment_demand(db)

        seg = next(r for r in result if r["segment"] == "Real Estate")
        assert seg["trending_up"] is False

    @pytest.mark.anyio
    async def test_result_sorted_by_avg_fill_rate_descending(self):
        events_tech = [
            _make_past_event(attendees_count=90, capacity=100, target_segments=["Tech & Founders"])
        ]
        events_re = [
            _make_past_event(attendees_count=30, capacity=100, target_segments=["Real Estate"])
        ]

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars(events_tech + events_re))

        result = await ForecastingEngine.get_segment_demand(db)

        assert result[0]["avg_fill_rate"] >= result[-1]["avg_fill_rate"]

    @pytest.mark.anyio
    async def test_returns_required_keys_per_entry(self):
        event = _make_past_event(attendees_count=50, capacity=100, target_segments=["Lifestyle & Leisure"])

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_db_execute_scalars([event]))

        result = await ForecastingEngine.get_segment_demand(db)

        assert len(result) == 1
        entry = result[0]
        assert "segment" in entry
        assert "event_count" in entry
        assert "avg_fill_rate" in entry
        assert "trending_up" in entry


# ── Helpers ───────────────────────────────────────────────────────────────────


def _next_weekday(target: int) -> datetime:
    """Return a datetime ≥ 20 days from now on the target weekday (0=Mon)."""
    base = datetime.now(timezone.utc) + timedelta(days=20)
    while base.weekday() != target:
        base += timedelta(days=1)
    return base
