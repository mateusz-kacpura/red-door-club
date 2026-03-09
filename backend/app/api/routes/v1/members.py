"""Member routes — profile, events, connections, taps, services."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.api.deps import CurrentUser, DBSession
from app.schemas.event import EventRead
from app.schemas.locker import LockerRead
from app.schemas.loyalty import LoyaltyTransactionRead, RedeemPointsRequest
from app.schemas.nfc import TapEventRead
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestRead
from app.schemas.tab import TabRead
from app.schemas.user import MemberProfileRead, UserRead, UserUpdate
from app.services.event import EventService
from app.services.nfc import NfcService
from app.services.user import UserService

router = APIRouter()


def get_event_service(db: DBSession) -> EventService:
    return EventService(db)


def get_nfc_service(db: DBSession) -> NfcService:
    return NfcService(db)


def get_user_service(db: DBSession) -> UserService:
    return UserService(db)


EventSvc = Annotated[EventService, Depends(get_event_service)]
NfcSvc = Annotated[NfcService, Depends(get_nfc_service)]
UserSvc = Annotated[UserService, Depends(get_user_service)]


@router.get("/me", response_model=MemberProfileRead, summary="Get member profile")
async def get_my_profile(current_user: CurrentUser, db: DBSession):
    from app.repositories import nfc as nfc_repo
    from app.repositories import user as user_repo
    from app.schemas.nfc import NfcCardRead

    nfc_cards = await nfc_repo.get_cards_by_member(db, current_user.id)
    match_count = await user_repo.get_match_score_count(db, current_user)

    return MemberProfileRead(
        **UserRead.model_validate(current_user).model_dump(),
        nfc_cards=[NfcCardRead.model_validate(c).model_dump() for c in nfc_cards],
        match_score_count=match_count,
    )


@router.patch("/me", response_model=UserRead, summary="Update member profile")
async def update_my_profile(
    user_in: UserUpdate,
    current_user: CurrentUser,
    user_service: UserSvc,
    db: DBSession,
):
    updated_user = await user_service.update(current_user.id, user_in)
    # Refresh segment groups after profile change
    from app.services.matching import MatchingEngine
    await MatchingEngine.refresh_segment_scores(db, updated_user)
    await db.commit()
    await db.refresh(updated_user)
    return updated_user


@router.get("/me/events", response_model=list[EventRead], summary="Get personalised event recommendations")
async def get_my_events(
    current_user: CurrentUser,
    event_service: EventSvc,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    return await event_service.list_events(current_user, skip=skip, limit=limit)


@router.get("/me/connections", summary="Get member connections")
async def get_my_connections(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    from sqlalchemy import or_, select
    from app.db.models.connection import Connection
    from app.db.models.user import User
    from app.schemas.connection import ConnectionRead, UserSummary

    result = await db.execute(
        select(Connection)
        .where(
            or_(
                Connection.member_a_id == current_user.id,
                Connection.member_b_id == current_user.id,
            )
        )
        .order_by(Connection.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    connections = result.scalars().all()

    output = []
    for conn in connections:
        other_id = conn.member_b_id if conn.member_a_id == current_user.id else conn.member_a_id
        other_user = await db.get(User, other_id)
        other_summary = None
        if other_user:
            other_summary = UserSummary(
                id=other_user.id,
                full_name=other_user.full_name,
                company_name=other_user.company_name,
                industry=other_user.industry,
                tier=other_user.tier,
            )
        read = ConnectionRead(
            id=conn.id,
            member_a_id=conn.member_a_id,
            member_b_id=conn.member_b_id,
            connection_type=conn.connection_type,
            notes=conn.notes,
            created_at=conn.created_at,
            other_member=other_summary,
        )
        output.append(read)

    return output


@router.get("/me/taps", response_model=list[TapEventRead], summary="Get tap history")
async def get_my_taps(
    current_user: CurrentUser,
    nfc_service: NfcSvc,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    return await nfc_service.get_tap_history(current_user.id, skip=skip, limit=limit)


@router.get("/me/services", response_model=list[ServiceRequestRead], summary="Get service requests")
async def get_my_services(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    from app.repositories import service_request as sr_repo
    return await sr_repo.get_by_member(db, current_user.id, skip=skip, limit=limit)


@router.post("/me/pre-arrival", response_model=ServiceRequestRead, status_code=201, summary="Submit pre-arrival request")
async def submit_pre_arrival(
    payload: ServiceRequestCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    from app.repositories import service_request as sr_repo
    return await sr_repo.create(
        db,
        member_id=current_user.id,
        request_type=payload.request_type,
        details=payload.details,
    )


@router.get("/me/locker", response_model=LockerRead | None, summary="Get current locker assignment")
async def get_my_locker(
    current_user: CurrentUser,
    db: DBSession,
):
    """Get the locker currently assigned to the authenticated member."""
    from app.repositories import locker as locker_repo
    return await locker_repo.get_by_member(db, current_user.id)


@router.get("/me/tab", response_model=TabRead | None, summary="Get current open tab")
async def get_my_tab(
    current_user: CurrentUser,
    db: DBSession,
):
    """Get the member's currently open tab with all items."""
    from app.repositories import tab as tab_repo
    return await tab_repo.get_open_tab(db, current_user.id)


@router.get("/me/suggestions", summary="Get AI-enhanced suggested connections")
async def get_my_suggestions(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(default=5, ge=1, le=20),
):
    """Return top member matches using multi-factor AI scoring (segments, shared events, in-venue, etc.)."""
    from app.services.matching import MatchingEngine
    return await MatchingEngine.get_enhanced_suggestions(db, current_user, limit=limit)


@router.get("/me/networking-report", summary="Get member networking report")
async def get_my_networking_report(
    current_user: CurrentUser,
    db: DBSession,
):
    """Return a summary of the member's networking activity with suggested next steps."""
    from app.services.matching import MatchingEngine
    return await MatchingEngine.generate_networking_report(db, current_user)


@router.get("/me/digest", summary="Get weekly networking digest")
async def get_my_weekly_digest(
    current_user: CurrentUser,
    db: DBSession,
):
    """Return top 3 AI-curated connection suggestions with reasons and next steps."""
    from app.services.matching import MatchingEngine
    return await MatchingEngine.get_weekly_digest(db, current_user)


@router.get("/me/connection-gaps", summary="Get connection network gap analysis")
async def get_my_connection_gaps(
    current_user: CurrentUser,
    db: DBSession,
):
    """Identify segment types missing or under-represented in the member's network."""
    from app.services.matching import MatchingEngine
    return await MatchingEngine.get_connection_gap_analysis(db, current_user)


@router.get("/me/engagement-health", summary="Get member engagement health (churn self-view)")
async def get_my_engagement_health(
    current_user: CurrentUser,
    db: DBSession,
):
    """Return risk level and actionable tips — no numeric score exposed to member."""
    from app.services.churn import ChurnPredictionEngine

    score_data = await ChurnPredictionEngine.get_churn_score(db, current_user)
    risk = score_data["risk_level"]

    tips: list[str] = []
    if risk in ("high", "critical"):
        tips += [
            "Visit us soon — we miss you! Your membership benefits are waiting.",
            "RSVP to the next club event to reconnect with your network.",
            "Open a tab at the bar to enjoy full Red Door Club hospitality.",
        ]
    elif risk == "medium":
        tips += [
            "Check the upcoming events — something new is happening soon.",
            "Tap your NFC card to grow your connection network.",
        ]
    elif risk == "low":
        tips.append("You're doing well! Explore new events to deepen your network.")
    else:
        tips.append("You're an active member — keep up the great engagement!")

    return {"risk_level": risk, "tips": tips}


@router.get("/me/tabs/{tab_id}/invoice", summary="Download PDF invoice for a closed tab")
async def download_tab_invoice(
    tab_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Generate and return a PDF invoice for one of the member's closed tabs."""
    from app.repositories import tab as tab_repo
    from app.core.exceptions import NotFoundError, AuthorizationError
    from app.services.invoice import generate_tab_invoice_pdf

    tab = await tab_repo.get_tab_by_id(db, tab_id)
    if tab is None:
        raise NotFoundError(message="Tab not found.")
    if tab.member_id != current_user.id:
        raise AuthorizationError(message="Not your tab.")

    pdf_bytes = generate_tab_invoice_pdf(tab, current_user)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"invoice-{tab_id}.pdf\""},
    )

# ── Loyalty & Points ──────────────────────────────────────────────────────────


@router.get("/me/points", summary="Get loyalty points balance")
async def get_my_points(
    current_user: CurrentUser,
    db: DBSession,
):
    """Return current balance and lifetime total RD Points."""
    from app.services.loyalty import LoyaltyService
    return await LoyaltyService.get_balance(db, current_user.id)


@router.get("/me/points/history", summary="Get loyalty transaction history")
async def get_my_points_history(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Return paginated loyalty transaction history for the authenticated member."""
    from app.services.loyalty import LoyaltyService
    from app.schemas.loyalty import LoyaltyTransactionRead
    txs = await LoyaltyService.get_transactions(db, current_user.id, limit=limit, offset=offset)
    return [LoyaltyTransactionRead.model_validate(tx) for tx in txs]


@router.post("/me/points/redeem", summary="Redeem loyalty points")
async def redeem_my_points(
    payload: RedeemPointsRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """Spend loyalty points on a reward. Fails if balance is insufficient."""
    from app.services.loyalty import LoyaltyService
    tx = await LoyaltyService.redeem_points(db, current_user.id, payload.amount, payload.reason)
    return LoyaltyTransactionRead.model_validate(tx)
