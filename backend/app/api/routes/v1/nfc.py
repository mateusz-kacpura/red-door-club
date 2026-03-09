"""NFC card routes."""

import json
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentAdmin, CurrentUser, DBSession, ReaderApiKey, Redis
from app.schemas.nfc import (
    BatchImportItem, BindCardRequest, ConnectionTapRequest, LockerTapRequest,
    NfcCardRead, TapEventRead, TapResponse,
)
from app.schemas.tab import PaymentTapRequest
from app.services.nfc import NfcService

router = APIRouter()


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_nfc_service(db: DBSession) -> NfcService:
    return NfcService(db)


NfcSvc = Annotated[NfcService, Depends(get_nfc_service)]


@router.get("/tap", response_model=TapResponse, summary="Handle NFC tap")
async def handle_tap(
    _: ReaderApiKey,
    redis: Redis,
    cid: str = Query(..., description="NFC card ID"),
    reader_id: str | None = Query(default=None),
    location: str | None = Query(default=None),
    nfc_service: NfcSvc = ...,
):
    """
    Called when a physical NFC reader detects a card tap.
    Optionally authenticates via X-API-Key header (when NFC_READER_API_KEY is configured).
    Returns the action to perform (setup, welcome, card_suspended).
    """
    result = await nfc_service.handle_tap(cid, reader_id=reader_id, location=location)
    if result.action == "welcome":
        try:
            await redis.publish("tap_events", json.dumps({
                "tap_type": "venue_entry",
                "action": result.action,
                "member_name": result.member_name,
                "member_id": str(result.member_id) if result.member_id else None,
                "location": location or "entrance",
                "tapped_at": _utcnow(),
            }))
        except Exception:
            pass
        if result.member_id:
            try:
                from app.services.loyalty import LoyaltyService
                tx = await LoyaltyService.award_points(
                    nfc_service.db, result.member_id, "event_attendance"
                )
                await redis.publish(f"member:{result.member_id}", json.dumps({
                    "tap_type": "venue_entry",
                    "action": "points_earned",
                    "message": f"You earned {tx.points} RD Points for today's visit!",
                }))
            except Exception:
                pass
    return result


@router.post("/bind", summary="Bind NFC card to current user")
async def bind_card(
    payload: BindCardRequest,
    current_user: CurrentUser,
    nfc_service: NfcSvc,
):
    """Bind an unbound NFC card to the authenticated user (First-Tap Onboarding)."""
    return await nfc_service.bind_card(payload.card_id, current_user.id)


@router.get("/card/{card_id}", response_model=NfcCardRead, summary="Get card status")
async def get_card(
    card_id: str,
    current_user: CurrentAdmin,
    nfc_service: NfcSvc,
):
    """Get NFC card status. Requires admin role."""
    return await nfc_service.get_card_status(card_id)


@router.post("/card/{card_id}/suspend", summary="Suspend NFC card")
async def suspend_card(
    card_id: str,
    current_user: CurrentAdmin,
    nfc_service: NfcSvc,
):
    """Suspend (deactivate) an NFC card. Admin only."""
    return await nfc_service.suspend_card(card_id)


@router.post("/batch-import", summary="Batch import NFC cards")
async def batch_import(
    cards: list[BatchImportItem],
    current_user: CurrentAdmin,
    nfc_service: NfcSvc,
):
    """Import a batch of pre-provisioned NFC card IDs. Admin only."""
    count = await nfc_service.batch_import(cards)
    return {"imported": count, "message": f"Successfully imported {count} cards."}


@router.get("/my-cards", response_model=list[NfcCardRead], summary="Get current user's NFC cards")
async def get_my_cards(
    current_user: CurrentUser,
    nfc_service: NfcSvc,
):
    """Get all NFC cards linked to the current user."""
    return await nfc_service.get_member_cards(current_user.id)


@router.post("/connection-tap", response_model=TapResponse, summary="Create member connection via NFC")
async def connection_tap(
    payload: ConnectionTapRequest,
    redis: Redis,
    nfc_service: NfcSvc,
):
    """
    Called by a staff NFC reader when two members present their cards.
    Creates a Connection between the two members.
    """
    result = await nfc_service.handle_connection_tap(
        payload.card_id_a,
        payload.card_id_b,
        reader_id=payload.reader_id,
        location=payload.location,
    )
    try:
        await redis.publish("tap_events", json.dumps({
            "tap_type": "connection_tap",
            "action": result.action,
            "member_name": result.member_name,
            "member_id": str(result.member_id) if result.member_id else None,
            "location": payload.location,
            "tapped_at": _utcnow(),
        }))
    except Exception:
        pass
    return result


@router.post("/payment-tap", response_model=TapResponse, summary="Add payment item to member tab via NFC")
async def payment_tap(
    payload: PaymentTapRequest,
    redis: Redis,
    nfc_service: NfcSvc,
):
    """
    Called by a bar/service NFC reader. Adds a line item to the member's open tab.
    Creates a tab automatically if none is open.
    """
    result = await nfc_service.handle_payment_tap(
        payload.card_id,
        payload.amount,
        payload.description,
        reader_id=payload.reader_id,
    )
    try:
        event_payload = json.dumps({
            "tap_type": "payment_tap",
            "action": result.action,
            "member_name": result.member_name,
            "member_id": str(result.member_id) if result.member_id else None,
            "location": payload.reader_id,
            "tapped_at": _utcnow(),
        })
        await redis.publish("tap_events", event_payload)
        if result.member_id:
            await redis.publish(f"member:{result.member_id}", json.dumps({
                "tap_type": "payment_tap",
                "action": result.action,
                "message": result.message,
            }))
    except Exception:
        pass
    if result.member_id:
        try:
            from app.services.loyalty import LoyaltyService
            tx = await LoyaltyService.award_points(
                nfc_service.db, result.member_id, "service_request"
            )
            await redis.publish(f"member:{result.member_id}", json.dumps({
                "tap_type": "payment_tap",
                "action": "points_earned",
                "message": f"You earned {tx.points} RD Points for this purchase!",
            }))
        except Exception:
            pass
    return result


@router.post("/locker-tap", response_model=TapResponse, summary="Assign or release locker via NFC")
async def locker_tap(
    payload: LockerTapRequest,
    redis: Redis,
    nfc_service: NfcSvc,
):
    """
    Called by a locker NFC reader. Assigns locker on first tap, releases on second tap to same locker.
    """
    result = await nfc_service.handle_locker_tap(
        payload.card_id,
        payload.locker_number,
        reader_id=payload.reader_id,
    )
    try:
        event_payload = json.dumps({
            "tap_type": "locker_access",
            "action": result.action,
            "member_name": result.member_name,
            "member_id": str(result.member_id) if result.member_id else None,
            "location": f"Locker {payload.locker_number}",
            "tapped_at": _utcnow(),
        })
        await redis.publish("tap_events", event_payload)
        if result.member_id:
            await redis.publish(f"member:{result.member_id}", json.dumps({
                "tap_type": "locker_access",
                "action": result.action,
                "message": result.message,
            }))
    except Exception:
        pass
    return result
