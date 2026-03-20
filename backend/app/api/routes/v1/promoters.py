"""Promoter portal routes."""

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.db.models.promoter import PayoutRequest, PromoCode, PromoCodeUse
from app.db.models.user import User
from app.schemas.promoter import (
    PayoutRequestCreate,
    PayoutRequestRead,
    PromoCodeCreate,
    PromoCodeRead,
    ReferralRead,
)
from app.services.promoter import PromoterService

router = APIRouter()


@router.get("/me/dashboard", summary="Promoter dashboard stats")
async def get_promoter_dashboard(current_user: CurrentUser, db: DBSession):
    """Return aggregate stats for the authenticated promoter."""
    return await PromoterService.get_stats(db, current_user.id)


@router.get("/me/codes", summary="List promoter's promo codes")
async def list_my_codes(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    result = await db.execute(
        select(PromoCode)
        .where(PromoCode.promoter_id == current_user.id)
        .order_by(PromoCode.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    codes = result.scalars().all()
    return [PromoCodeRead.model_validate(c) for c in codes]


@router.post("/me/codes", status_code=201, summary="Create a new promo code")
async def create_my_code(
    current_user: CurrentUser,
    db: DBSession,
    payload: PromoCodeCreate,
):
    code = PromoCode(
        code=payload.code.upper(),
        promoter_id=current_user.id,
        tier_grant=payload.tier_grant,
        quota=payload.quota,
        reg_commission=payload.reg_commission,
        checkin_commission_flat=payload.checkin_commission_flat,
        checkin_commission_pct=payload.checkin_commission_pct,
    )
    db.add(code)
    await db.commit()
    await db.refresh(code)
    return PromoCodeRead.model_validate(code)


@router.get("/me/payouts", summary="List payout requests")
async def list_my_payouts(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    result = await db.execute(
        select(PayoutRequest)
        .where(PayoutRequest.promoter_id == current_user.id)
        .order_by(PayoutRequest.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    payouts = result.scalars().all()
    return [PayoutRequestRead.model_validate(p) for p in payouts]


@router.post("/me/request-payout", status_code=201, summary="Request a commission payout")
async def request_payout(
    current_user: CurrentUser,
    db: DBSession,
    payload: PayoutRequestCreate,
):
    payout = await PromoterService.request_payout(db, current_user.id, payload.amount)
    return PayoutRequestRead.model_validate(payout)


@router.get("/me/referrals", summary="List users referred by promoter")
async def list_my_referrals(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Return users who registered using this promoter's promo codes."""
    result = await db.execute(
        select(
            User.full_name,
            PromoCode.code,
            PromoCodeUse.created_at,
        )
        .join(PromoCode, PromoCodeUse.code_id == PromoCode.id)
        .join(User, PromoCodeUse.user_id == User.id)
        .where(PromoCode.promoter_id == current_user.id)
        .order_by(PromoCodeUse.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.all()
    return [
        ReferralRead(
            user_full_name=row.full_name,
            promo_code=row.code,
            registered_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/leaderboard", summary="Promoter leaderboard")
async def get_leaderboard(
    db: DBSession,
    limit: int = Query(default=10, ge=1, le=50),
):
    return await PromoterService.get_leaderboard(db, limit=limit)
