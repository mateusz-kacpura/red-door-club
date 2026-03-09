"""Event routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentAdmin, CurrentUser, DBSession
from app.schemas.event import EventRead
from app.services.event import EventService

router = APIRouter()


def get_event_service(db: DBSession) -> EventService:
    return EventService(db)


EventSvc = Annotated[EventService, Depends(get_event_service)]


@router.get("", response_model=list[EventRead], summary="List events (personalised)")
async def list_events(
    current_user: CurrentUser,
    event_service: EventSvc,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    return await event_service.list_events(current_user, skip=skip, limit=limit)


@router.get("/{event_id}", response_model=EventRead, summary="Get event detail")
async def get_event(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    event_service: EventSvc,
):
    return await event_service.get_event(event_id)


@router.post("/{event_id}/rsvp", status_code=200, summary="RSVP to event")
async def rsvp_event(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    event_service: EventSvc,
):
    added = await event_service.rsvp(event_id, current_user.id)
    return {"rsvped": added, "message": "RSVP successful." if added else "Already RSVPed."}


@router.delete("/{event_id}/rsvp", status_code=200, summary="Cancel RSVP")
async def cancel_rsvp(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    event_service: EventSvc,
):
    removed = await event_service.cancel_rsvp(event_id, current_user.id)
    return {"cancelled": removed}


@router.post("/{event_id}/checkin", status_code=200, summary="Staff check-in override")
async def checkin(
    event_id: uuid.UUID,
    member_id: uuid.UUID,
    card_id: str | None = Query(default=None),
    current_user: CurrentAdmin = ...,
    event_service: EventSvc = ...,
):
    """Manual check-in without NFC. Requires admin role."""
    await event_service.checkin(event_id, member_id, card_id=card_id)
    return {"checked_in": True}
