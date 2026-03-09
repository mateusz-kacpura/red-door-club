"""Event service."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.models.user import User
from app.repositories import event as event_repo
from app.repositories import nfc as nfc_repo
from app.schemas.event import EventCreate, EventRead, EventUpdate

TIER_ORDER = {"silver": 1, "gold": 2, "obsidian": 3}


def _member_tier_value(tier: str | None) -> int:
    return TIER_ORDER.get(tier or "", 0)


def _compute_match_score(event, member: User) -> float:
    """Compute how well an event matches a member's segments (0.0–1.0)."""
    if not event.target_segments:
        return 0.5
    member_segs = set(member.segment_groups or [])
    event_segs = set(event.target_segments)
    if not event_segs:
        return 0.5
    overlap = len(member_segs & event_segs)
    return round(overlap / len(event_segs), 2)


class EventService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_events(
        self,
        member: User,
        skip: int = 0,
        limit: int = 20,
        include_all: bool = False,
    ) -> list[EventRead]:
        if include_all:
            events = await event_repo.get_all(self.db, skip=skip, limit=limit)
        else:
            events = await event_repo.get_published(self.db, skip=skip, limit=limit)

        results = []
        for event in events:
            # Filter by tier
            if event.min_tier and _member_tier_value(member.tier) < _member_tier_value(event.min_tier):
                continue

            match_score = _compute_match_score(event, member)
            rsvp_count = await event_repo.get_rsvp_count(self.db, event.id)
            is_rsvped = await event_repo.is_rsvped(self.db, event.id, member.id)

            read = EventRead.model_validate(event)
            read.match_score = match_score
            read.rsvp_count = rsvp_count
            read.is_rsvped = is_rsvped
            results.append(read)

        # Sort by match score descending
        results.sort(key=lambda e: e.match_score or 0, reverse=True)
        return results

    async def get_event(self, event_id: uuid.UUID) -> EventRead:
        event = await event_repo.get_by_id(self.db, event_id)
        if event is None:
            raise NotFoundError(message=f"Event not found: {event_id}")
        rsvp_count = await event_repo.get_rsvp_count(self.db, event_id)
        read = EventRead.model_validate(event)
        read.rsvp_count = rsvp_count
        return read

    async def rsvp(self, event_id: uuid.UUID, member_id: uuid.UUID) -> bool:
        event = await event_repo.get_by_id(self.db, event_id)
        if event is None:
            raise NotFoundError(message=f"Event not found: {event_id}")
        if event.status != "published":
            raise BadRequestError(message="Cannot RSVP to this event.")
        rsvp_count = await event_repo.get_rsvp_count(self.db, event_id)
        if rsvp_count >= event.capacity:
            raise BadRequestError(message="Event is at full capacity.")
        return await event_repo.add_rsvp(self.db, event_id, member_id)

    async def cancel_rsvp(self, event_id: uuid.UUID, member_id: uuid.UUID) -> bool:
        event = await event_repo.get_by_id(self.db, event_id)
        if event is None:
            raise NotFoundError(message=f"Event not found: {event_id}")
        return await event_repo.remove_rsvp(self.db, event_id, member_id)

    async def create_event(self, event_in: EventCreate) -> EventRead:
        data = event_in.model_dump()
        event = await event_repo.create(self.db, **data)
        return EventRead.model_validate(event)

    async def update_event(self, event_id: uuid.UUID, event_in: EventUpdate) -> EventRead:
        event = await event_repo.get_by_id(self.db, event_id)
        if event is None:
            raise NotFoundError(message=f"Event not found: {event_id}")
        update_data = event_in.model_dump(exclude_unset=True)
        event = await event_repo.update(self.db, event, update_data)
        return EventRead.model_validate(event)

    async def checkin(
        self,
        event_id: uuid.UUID,
        member_id: uuid.UUID,
        card_id: str | None = None,
    ) -> bool:
        event = await event_repo.get_by_id(self.db, event_id)
        if event is None:
            raise NotFoundError(message=f"Event not found: {event_id}")

        if card_id:
            await nfc_repo.log_tap_event(
                self.db,
                card_id=card_id,
                tap_type="event_checkin",
                member_id=member_id,
                metadata={"event_id": str(event_id)},
            )
        return True
