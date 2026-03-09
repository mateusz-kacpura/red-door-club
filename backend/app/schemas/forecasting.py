"""Schemas for event demand forecasting and peak-hours analytics."""

from uuid import UUID

from pydantic import BaseModel


class EventForecastRead(BaseModel):
    event_id: UUID
    event_title: str
    predicted_attendees: int
    actual_capacity: int
    capacity_utilization_pct: float
    confidence: str  # "high" | "medium" | "low"
    similar_events_count: int
    recommendation: str


class PeakHoursRead(BaseModel):
    heatmap: list[list[int]]  # [weekday 0-6][hour 0-23] — tap counts
    busiest_slot: dict   # {weekday_name, hour, avg_count}
    quietest_slot: dict


class SegmentDemandRead(BaseModel):
    segment: str
    event_count: int
    avg_fill_rate: float
    trending_up: bool
