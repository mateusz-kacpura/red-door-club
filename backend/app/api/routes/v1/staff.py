"""Staff routes — QR-based door checkin."""

import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import CurrentStaff, DBSession, Redis
from app.services.staff import StaffService

router = APIRouter()


def get_staff_service(db: DBSession) -> StaffService:
    return StaffService(db)


StaffSvc = Annotated[StaffService, Depends(get_staff_service)]


class CheckinRequest(BaseModel):
    member_id: uuid.UUID
    event_id: uuid.UUID


@router.get("/member/{member_id}", summary="Get member info for checkin")
async def get_member_for_checkin(
    member_id: uuid.UUID,
    current_user: CurrentStaff,
    staff_service: StaffSvc,
):
    return await staff_service.get_member_for_checkin(member_id)


@router.get("/today-events", summary="Get today's published events")
async def get_today_events(
    current_user: CurrentStaff,
    staff_service: StaffSvc,
):
    return await staff_service.get_today_events()


@router.post("/checkin", summary="Check in a member to an event via QR")
async def checkin(
    payload: CheckinRequest,
    current_user: CurrentStaff,
    staff_service: StaffSvc,
    redis: Redis,
):
    result = await staff_service.checkin(
        member_id=payload.member_id,
        event_id=payload.event_id,
        staff_id=current_user.id,
    )

    # Publish to Redis for real-time updates
    try:
        await redis.publish("tap_events", json.dumps({
            "tap_type": "qr_entry",
            "member_name": result["member_name"],
            "member_id": str(payload.member_id),
            "event_title": result["event_title"],
            "fee": result["fee"],
            "is_promo": result["is_promo"],
            "staff_id": str(current_user.id),
        }))
    except Exception:
        pass

    return result
