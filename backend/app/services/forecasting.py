"""Event demand forecasting and peak-hours analytics."""

import statistics
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.event import Event

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Weekday multipliers (0=Mon … 6=Sun)
WEEKDAY_FACTOR: dict[int, float] = {
    0: 0.7,  # Monday
    1: 0.8,
    2: 0.9,
    3: 1.0,
    4: 1.2,
    5: 1.5,  # Saturday (peak)
    6: 1.1,
}


class ForecastingEngine:
    """Heuristic demand forecasting — no external ML dependencies."""

    @staticmethod
    async def predict_event_attendance(db: AsyncSession, event: Event) -> dict:
        """Predict attendance for a future event using similar historical events.

        Algorithm:
        1. Find past events with same event_type + ≥1 shared target_segment + status='completed'
        2. baseline = median(attendees) if ≥3 similar events, else mean, else capacity × 0.6
        3. Apply weekday, price, and days-ahead factors
        4. Clamp to capacity
        """
        now = datetime.now(timezone.utc)

        # Find similar completed events
        result = await db.execute(
            select(Event).where(
                Event.id != event.id,
                Event.status == "completed",
                Event.event_type == event.event_type,
            )
        )
        all_past = result.scalars().all()

        # Filter to those sharing ≥1 target segment (if event has segments)
        event_segs = set(event.target_segments or [])
        if event_segs:
            similar = [
                e for e in all_past
                if event_segs & set(e.target_segments or [])
            ]
        else:
            similar = all_past

        # Compute baseline
        similar_count = len(similar)
        if similar_count == 0:
            baseline = float(event.capacity) * 0.6
            confidence = "low"
        else:
            attendance_counts = [len(e.attendees) for e in similar]
            if similar_count >= 5:
                confidence = "high"
            elif similar_count >= 2:
                confidence = "medium"
            else:
                confidence = "low"

            if similar_count >= 3:
                baseline = float(statistics.median(attendance_counts))
            else:
                baseline = float(statistics.mean(attendance_counts))

        # Correction factors
        starts_at = event.starts_at
        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=timezone.utc)
        weekday = starts_at.weekday()
        weekday_factor = WEEKDAY_FACTOR.get(weekday, 1.0)

        price_factor = 0.8 if float(event.ticket_price) > 0 else 1.0

        days_ahead = (starts_at - now).days
        if days_ahead >= 14:
            days_ahead_factor = 1.0
        elif days_ahead >= 7:
            days_ahead_factor = 0.9
        else:
            days_ahead_factor = 0.8

        predicted = int(baseline * weekday_factor * price_factor * days_ahead_factor)
        predicted = min(predicted, event.capacity)
        predicted = max(predicted, 0)

        utilization_pct = round(predicted / event.capacity * 100, 1) if event.capacity > 0 else 0.0

        # Recommendation
        if utilization_pct >= 90:
            recommendation = "Consider increasing capacity or running a waitlist — high demand expected."
        elif utilization_pct >= 70:
            recommendation = "Good fill rate expected. Promote to remaining target segments."
        elif confidence == "low":
            recommendation = "Limited historical data. Promote widely to improve attendance."
        else:
            seg_list = ", ".join(list(event_segs)[:2]) if event_segs else "all members"
            recommendation = f"Target {seg_list} segments directly to boost attendance."

        return {
            "event_id": event.id,
            "event_title": event.title,
            "predicted_attendees": predicted,
            "actual_capacity": event.capacity,
            "capacity_utilization_pct": utilization_pct,
            "confidence": confidence,
            "similar_events_count": similar_count,
            "recommendation": recommendation,
        }

    @staticmethod
    async def get_peak_hours(db: AsyncSession) -> dict:
        """Aggregate TapEvent timestamps into a 7×24 heatmap (weekday × hour)."""
        result = await db.execute(
            text(
                "SELECT EXTRACT(DOW FROM tapped_at AT TIME ZONE 'UTC') AS dow, "
                "       EXTRACT(HOUR FROM tapped_at AT TIME ZONE 'UTC') AS hr, "
                "       COUNT(*) AS cnt "
                "FROM tap_events "
                "GROUP BY dow, hr"
            )
        )
        rows = result.fetchall()

        # dow: 0=Sunday in postgres, we convert to 0=Monday
        heatmap: list[list[int]] = [[0] * 24 for _ in range(7)]
        for row in rows:
            pg_dow = int(row[0])  # 0=Sun..6=Sat in postgres DOW
            hr = int(row[1])
            cnt = int(row[2])
            # Convert to Mon=0
            py_dow = (pg_dow - 1) % 7
            heatmap[py_dow][hr] = cnt

        # Find busiest and quietest non-zero slots
        busiest = {"weekday_name": "Monday", "hour": 0, "count": 0}
        quietest = {"weekday_name": "Monday", "hour": 0, "count": float("inf")}
        has_any = False
        for d in range(7):
            for h in range(24):
                val = heatmap[d][h]
                if val > 0:
                    has_any = True
                    if val > busiest["count"]:
                        busiest = {"weekday_name": WEEKDAY_NAMES[d], "hour": h, "count": val}
                    if val < quietest["count"]:
                        quietest = {"weekday_name": WEEKDAY_NAMES[d], "hour": h, "count": val}

        if not has_any:
            quietest = {"weekday_name": "N/A", "hour": 0, "count": 0}

        return {
            "heatmap": heatmap,
            "busiest_slot": busiest,
            "quietest_slot": quietest,
        }

    @staticmethod
    async def get_segment_demand(db: AsyncSession) -> list[dict]:
        """Return per-segment event engagement statistics."""
        result = await db.execute(select(Event).where(Event.status == "completed"))
        completed_events = result.scalars().all()

        segment_stats: dict[str, list[float]] = {}
        for event in completed_events:
            attendee_count = len(event.attendees)
            fill_rate = attendee_count / event.capacity if event.capacity > 0 else 0.0
            for seg in (event.target_segments or []):
                segment_stats.setdefault(seg, []).append(fill_rate)

        # Compute trend: compare last 50% of events vs first 50% per segment
        output: list[dict] = []
        for seg, rates in segment_stats.items():
            avg_fill = round(statistics.mean(rates), 3)
            n = len(rates)
            if n >= 4:
                mid = n // 2
                early_avg = statistics.mean(rates[:mid])
                late_avg = statistics.mean(rates[mid:])
                trending_up = late_avg > early_avg
            else:
                trending_up = False

            output.append({
                "segment": seg,
                "event_count": n,
                "avg_fill_rate": avg_fill,
                "trending_up": trending_up,
            })

        output.sort(key=lambda x: x["avg_fill_rate"], reverse=True)
        return output
