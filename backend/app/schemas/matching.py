"""Schemas for AI matching, suggestions, and deal-flow."""

from datetime import datetime

from pydantic import BaseModel


class EnhancedSuggestionRead(BaseModel):
    member_id: str
    full_name: str | None
    tier: str | None
    company_name: str | None
    industry: str | None
    shared_segments: list[str]
    shared_events_count: int
    score: float
    reason_text: str
    is_in_venue: bool


class WeeklyDigestRead(BaseModel):
    top_suggestions: list[EnhancedSuggestionRead]
    next_steps: list[str]
    generated_at: datetime


class DealFlowPairRead(BaseModel):
    buyer: dict
    seller: dict
    mutual_connections: int
    score: float


class ConnectionGapRead(BaseModel):
    user_segments: list[str]
    connected_segments: dict  # {segment_name: connection_count}
    missing_or_weak_segments: list[str]
    priority_suggestions: list[EnhancedSuggestionRead]
