"""Admin / operations panel routes."""

import csv
import io
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.api.deps import CurrentAdmin, DBSession, UserSvc
from app.core.config import settings
from app.schemas.event import EventCreate, EventRead, EventUpdate
from app.schemas.qr_batch import QrBatchCreate, QrBatchRead, QrBatchDetail, QrBatchModify, QrBatchDeleteRequest
from app.schemas.locker import LockerCreate, LockerRead
from app.schemas.loyalty import AdminAwardPointsRequest, LoyaltyTransactionRead
from app.schemas.service_request import ServiceRequestRead, ServiceRequestUpdate, ServiceRequestAdminUpdate
from app.schemas.tab import TabRead
from app.schemas.user import UserRead, UserUpdate
from app.services.admin import AdminService
from app.services.event import EventService


class StaffNotesPayload(BaseModel):
    notes: str | None = None


class AdminCreatePromoCode(BaseModel):
    code: str
    promoter_id: uuid.UUID
    tier_grant: str | None = None
    quota: int = 0
    commission_rate: float = 0.50


class AdminUpdatePromoCode(BaseModel):
    is_active: bool | None = None
    quota: int | None = None


class AdminApprovePayoutRequest(BaseModel):
    notes: str | None = None


router = APIRouter()


def get_admin_service(db: DBSession) -> AdminService:
    return AdminService(db)


def get_event_service(db: DBSession) -> EventService:
    return EventService(db)


AdminSvc = Annotated[AdminService, Depends(get_admin_service)]
EventSvc = Annotated[EventService, Depends(get_event_service)]


# ── Members ─────────────────────────────────────────────────────────────────


@router.get("/members", summary="List all members")
async def list_members(
    current_user: CurrentAdmin,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    user_type: str | None = Query(default=None),
):
    from sqlalchemy import select
    from app.db.models.user import User

    query = select(User).where(User.is_active == True)  # noqa: E712
    if user_type:
        query = query.where(User.user_type == user_type)
    result = await db.execute(query.order_by(User.created_at.desc()).offset(skip).limit(limit))
    users = result.scalars().all()
    return [UserRead.model_validate(u) for u in users]


@router.get("/members/{member_id}", summary="Member detail (CRM)")
async def get_member_detail(
    member_id: uuid.UUID,
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
):
    return await admin_service.get_member_detail(member_id)


@router.patch("/members/{member_id}", response_model=UserRead, summary="Update member profile (admin)")
async def update_member(
    member_id: uuid.UUID,
    user_in: UserUpdate,
    current_user: CurrentAdmin,
    user_service: UserSvc,
):
    return await user_service.update(member_id, user_in)


@router.patch("/members/{member_id}/notes", summary="Update staff notes for a member")
async def update_member_notes(
    member_id: uuid.UUID,
    payload: StaffNotesPayload,
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
):
    return await admin_service.update_member_notes(member_id, payload.notes)


# ── Floor view ───────────────────────────────────────────────────────────────


@router.get("/floor", summary="Live floor view — currently in venue")
async def get_floor_view(
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
):
    return await admin_service.get_floor_view()


# ── Prep checklist ───────────────────────────────────────────────────────────


@router.get("/prep-checklist", response_model=list[ServiceRequestRead], summary="Today's prep checklist")
async def get_prep_checklist(
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
):
    return await admin_service.get_prep_checklist()


@router.patch("/prep-checklist/{request_id}", summary="Mark checklist item complete")
async def complete_checklist_item(
    request_id: uuid.UUID,
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
):
    return await admin_service.complete_checklist_item(request_id)


# ── Analytics ────────────────────────────────────────────────────────────────


@router.get("/analytics/overview", summary="Analytics KPI overview")
async def get_analytics(
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
):
    return await admin_service.get_analytics()


@router.get("/analytics/revenue", summary="Revenue analytics from closed tabs")
async def get_revenue_analytics(
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
):
    return await admin_service.get_revenue_summary()


# ── Services (concierge operations) ──────────────────────────────────────────


@router.get("/services", summary="List all service requests (admin)")
async def list_service_requests(
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
    status: str | None = Query(default=None),
    request_type: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    return await admin_service.list_service_requests(status, request_type, skip, limit)


@router.patch("/services/{request_id}", summary="Update service request status / assignment")
async def update_service_request(
    request_id: uuid.UUID,
    payload: ServiceRequestAdminUpdate,
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
):
    return await admin_service.update_service_request(
        request_id, payload.status, payload.assigned_to, payload.staff_notes
    )


# ── Activity log ──────────────────────────────────────────────────────────────


@router.get("/activity", summary="Tap event activity log (paginated)")
async def list_activity(
    current_user: CurrentAdmin,
    admin_service: AdminSvc,
    tap_type: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
):
    return await admin_service.list_activity(tap_type, skip, limit)


# ── Events management ────────────────────────────────────────────────────────


@router.get("/events", response_model=list[EventRead], summary="List all events (admin)")
async def list_all_events(
    current_user: CurrentAdmin,
    event_service: EventSvc,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    return await event_service.list_events(current_user, skip=skip, limit=limit, include_all=True)


@router.post("/events", response_model=EventRead, status_code=201, summary="Create event")
async def create_event(
    event_in: EventCreate,
    current_user: CurrentAdmin,
    event_service: EventSvc,
):
    return await event_service.create_event(event_in)


@router.patch("/events/{event_id}", response_model=EventRead, summary="Update event")
async def update_event(
    event_id: uuid.UUID,
    event_in: EventUpdate,
    current_user: CurrentAdmin,
    event_service: EventSvc,
):
    return await event_service.update_event(event_id, event_in)


# ── Lockers ──────────────────────────────────────────────────────────────────


@router.get("/lockers", response_model=list[LockerRead], summary="List all lockers")
async def list_lockers(
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.repositories import locker as locker_repo
    return await locker_repo.list_all(db)


@router.post("/lockers", response_model=LockerRead, status_code=201, summary="Create locker")
async def create_locker(
    payload: LockerCreate,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.repositories import locker as locker_repo
    return await locker_repo.create(db, payload.locker_number, payload.location)


@router.delete("/lockers/{locker_number}/release", summary="Force release locker")
async def force_release_locker(
    locker_number: str,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.repositories import locker as locker_repo
    from app.core.exceptions import NotFoundError
    locker = await locker_repo.get_by_number(db, locker_number)
    if locker is None:
        raise NotFoundError(message=f"Locker {locker_number} not found.")
    released = await locker_repo.release(db, locker)
    return {"locker_number": released.locker_number, "status": released.status}


# ── Tabs ──────────────────────────────────────────────────────────────────────


@router.get("/tabs", response_model=list[TabRead], summary="List all open tabs")
async def list_open_tabs(
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.repositories import tab as tab_repo
    return await tab_repo.list_open_tabs(db)


@router.post("/tabs/{tab_id}/close", response_model=TabRead, summary="Close a member tab")
async def close_tab(
    tab_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.repositories import tab as tab_repo
    from app.core.exceptions import NotFoundError
    tab = await tab_repo.get_tab_by_id(db, tab_id)
    if tab is None:
        raise NotFoundError(message="Tab not found.")
    return await tab_repo.close_tab(db, tab)


@router.get("/tabs/{tab_id}/invoice", summary="Download PDF invoice for a tab (admin)")
async def download_tab_invoice_admin(
    tab_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    """Generate and return a PDF invoice for any tab. Admin access only."""
    from app.repositories import tab as tab_repo
    from app.core.exceptions import NotFoundError
    from app.services.invoice import generate_tab_invoice_pdf

    tab = await tab_repo.get_tab_by_id(db, tab_id)
    if tab is None:
        raise NotFoundError(message="Tab not found.")

    member = await db.get(__import__("app.db.models.user", fromlist=["User"]).User, tab.member_id)
    pdf_bytes = generate_tab_invoice_pdf(tab, member)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"invoice-{tab_id}.pdf\""},
    )


# ── Promoters (admin) ─────────────────────────────────────────────────────────


@router.get("/promoters", summary="List all promoters with stats")
async def list_promoters(
    current_user: CurrentAdmin,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    from sqlalchemy import select
    from app.db.models.user import User
    from app.services.promoter import PromoterService

    result = await db.execute(
        select(User)
        .where(User.is_promoter == True)  # noqa: E712
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    promoters = result.scalars().all()
    out = []
    for p in promoters:
        stats = await PromoterService.get_stats(db, p.id)
        out.append({
            "promoter_id": str(p.id),
            "full_name": p.full_name,
            "email": p.email,
            "company_name": p.company_name,
            **stats,
        })
    return out


@router.post("/promoters/{member_id}/make-promoter", status_code=200, summary="Grant promoter status to a member")
async def make_promoter(
    member_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.db.models.user import User
    from app.core.exceptions import NotFoundError
    user = await db.get(User, member_id)
    if user is None:
        raise NotFoundError(message="Member not found.")
    user.is_promoter = True
    user.user_type = "promoter"
    await db.commit()
    return {"promoter_id": str(user.id), "is_promoter": True, "user_type": "promoter"}


@router.post("/promo-codes", status_code=201, summary="Create a promo code for a promoter")
async def admin_create_promo_code(
    current_user: CurrentAdmin,
    db: DBSession,
    payload: "AdminCreatePromoCode",
):
    from app.db.models.promoter import PromoCode
    from app.schemas.promoter import PromoCodeRead

    code = PromoCode(
        code=payload.code.upper(),
        promoter_id=payload.promoter_id,
        tier_grant=payload.tier_grant,
        quota=payload.quota,
        commission_rate=payload.commission_rate,
    )
    db.add(code)
    await db.commit()
    await db.refresh(code)
    return PromoCodeRead.model_validate(code)


@router.patch("/promo-codes/{code_id}", summary="Update promo code (deactivate / change quota)")
async def admin_update_promo_code(
    code_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
    payload: "AdminUpdatePromoCode",
):
    from app.db.models.promoter import PromoCode
    from app.core.exceptions import NotFoundError
    from app.schemas.promoter import PromoCodeRead

    code = await db.get(PromoCode, code_id)
    if code is None:
        raise NotFoundError(message="Promo code not found.")
    if payload.is_active is not None:
        code.is_active = payload.is_active
    if payload.quota is not None:
        code.quota = payload.quota
    await db.commit()
    await db.refresh(code)
    return PromoCodeRead.model_validate(code)


@router.post("/promoters/payouts/{payout_id}/approve", status_code=200, summary="Approve a payout request")
async def approve_payout(
    payout_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
    payload: "AdminApprovePayoutRequest",
):
    from app.schemas.promoter import AdminApprovePayoutRequest, PayoutRequestRead
    from app.services.promoter import PromoterService
    payout = await PromoterService.approve_payout(db, payout_id, notes=payload.notes)
    return PayoutRequestRead.model_validate(payout)


# ── Loyalty (admin) ───────────────────────────────────────────────────────────


@router.get("/loyalty/leaderboard", summary="Loyalty leaderboard — top members by lifetime points")
async def get_loyalty_leaderboard(
    current_user: CurrentAdmin,
    db: DBSession,
    limit: int = Query(default=10, ge=1, le=50),
):
    from app.services.loyalty import LoyaltyService
    return await LoyaltyService.get_leaderboard(db, limit=limit)


@router.post("/loyalty/award", status_code=201, summary="Manually award loyalty points to a member")
async def admin_award_points(
    current_user: CurrentAdmin,
    db: DBSession,
    payload: AdminAwardPointsRequest,
):
    from app.services.loyalty import LoyaltyService
    tx = await LoyaltyService.award_points(
        db,
        member_id=payload.member_id,
        reason="manual_award",
        points=payload.amount,
    )
    return LoyaltyTransactionRead.model_validate(tx)


# ── Analytics v2 ─────────────────────────────────────────────────────────────


@router.get("/analytics/loyalty", summary="Loyalty analytics KPIs")
async def get_loyalty_analytics(
    current_user: CurrentAdmin,
    db: DBSession,
):
    from sqlalchemy import func, select
    from app.db.models.loyalty import LoyaltyTransaction
    from app.db.models.user import User

    # Points earned YTD
    earned = await db.scalar(
        select(func.coalesce(func.sum(LoyaltyTransaction.points), 0))
        .where(LoyaltyTransaction.points > 0)
    ) or 0

    # Points redeemed YTD
    redeemed = await db.scalar(
        select(func.coalesce(func.sum(LoyaltyTransaction.points), 0))
        .where(LoyaltyTransaction.points < 0)
    ) or 0

    # Avg balance
    avg_balance = await db.scalar(
        select(func.avg(User.loyalty_points)).where(User.is_active == True)  # noqa: E712
    ) or 0

    # Tier distribution
    tier_result = await db.execute(
        select(User.tier, func.count(User.id)).where(User.is_active == True).group_by(User.tier)  # noqa: E712
    )
    tier_dist = {row[0] or "none": row[1] for row in tier_result.all()}

    return {
        "points_earned_total": int(earned),
        "points_redeemed_total": abs(int(redeemed)),
        "avg_balance": round(float(avg_balance), 1),
        "tier_distribution": tier_dist,
    }


@router.get("/analytics/promoters", summary="Promoter analytics KPIs")
async def get_promoter_analytics(
    current_user: CurrentAdmin,
    db: DBSession,
):
    from sqlalchemy import func, select
    from app.db.models.promoter import PromoCode, PromoCodeUse
    from app.db.models.user import User

    active_codes = await db.scalar(
        select(func.count(PromoCode.id)).where(PromoCode.is_active == True)  # noqa: E712
    ) or 0

    total_uses = await db.scalar(select(func.sum(PromoCode.uses_count))) or 0

    total_revenue = await db.scalar(
        select(func.coalesce(func.sum(PromoCode.revenue_attributed), 0))
    ) or 0

    # Top promoter by uses
    top_result = await db.execute(
        select(User.full_name, func.sum(PromoCode.uses_count).label("uses"))
        .join(PromoCode, PromoCode.promoter_id == User.id)
        .where(User.is_promoter == True)  # noqa: E712
        .group_by(User.id, User.full_name)
        .order_by(func.sum(PromoCode.uses_count).desc())
        .limit(1)
    )
    top_row = top_result.first()

    return {
        "active_codes": int(active_codes),
        "total_conversions": int(total_uses),
        "total_attributed_revenue": float(total_revenue),
        "top_promoter": top_row[0] if top_row else None,
        "top_promoter_uses": top_row[1] if top_row else 0,
    }


@router.get("/analytics/corporate", summary="Corporate analytics KPIs")
async def get_corporate_analytics(
    current_user: CurrentAdmin,
    db: DBSession,
):
    from sqlalchemy import func, select
    from app.db.models.corporate import CorporateAccount

    active_accounts = await db.scalar(
        select(func.count(CorporateAccount.id)).where(CorporateAccount.status == "active")
    ) or 0

    totals = await db.execute(
        select(
            func.sum(CorporateAccount.max_seats),
            func.sum(CorporateAccount.active_seats),
            func.sum(CorporateAccount.annual_fee),
        ).where(CorporateAccount.status == "active")
    )
    row = totals.first()
    total_seats = int(row[0] or 0)
    utilized_seats = int(row[1] or 0)
    total_annual = float(row[2] or 0)

    return {
        "active_accounts": int(active_accounts),
        "total_seats": total_seats,
        "utilized_seats": utilized_seats,
        "seat_utilization_pct": round((utilized_seats / total_seats * 100) if total_seats else 0, 1),
        "total_annual_revenue": total_annual,
        "monthly_revenue": round(total_annual / 12, 2),
    }


@router.get("/analytics/export-csv", summary="Export revenue CSV of all closed tabs")
async def export_revenue_csv(
    current_user: CurrentAdmin,
    db: DBSession,
):
    """Stream a CSV file with all closed tabs: id, member, opened_at, closed_at, total, items."""
    from sqlalchemy import select
    from app.db.models.tab import Tab
    from app.db.models.user import User

    result = await db.execute(
        select(Tab, User.full_name)
        .join(User, Tab.member_id == User.id, isouter=True)
        .where(Tab.status == "closed")
        .order_by(Tab.closed_at.desc())
    )
    rows = result.all()

    def generate_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["tab_id", "member_name", "opened_at", "closed_at", "total_amount", "items_count"])
        for tab, member_name in rows:
            writer.writerow([
                str(tab.id),
                member_name or "",
                tab.opened_at.isoformat() if tab.opened_at else "",
                tab.closed_at.isoformat() if tab.closed_at else "",
                str(tab.total_amount),
                len(tab.items) if tab.items else 0,
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=\"revenue-export.csv\""},
    )


# ── Phase 6: AI Matching ──────────────────────────────────────────────────────


@router.get("/matching/deal-flow", summary="Get deal-flow buyer-seller pairs")
async def get_deal_flow_pairs(
    current_user: CurrentAdmin,
    db: DBSession,
    limit: int = Query(default=20, ge=1, le=50),
):
    """Return member pairs with buyer/seller segment complementarity for staff introductions."""
    from app.services.matching import MatchingEngine
    return await MatchingEngine.get_deal_flow_pairs(db, limit=limit)


# ── Phase 6B: Event Demand Forecasting ───────────────────────────────────────


@router.get("/analytics/forecast/{event_id}", summary="Predict event attendance")
async def forecast_event_attendance(
    event_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    """Return AI attendance prediction for a future event."""
    from app.db.models.event import Event
    from app.core.exceptions import NotFoundError
    from app.services.forecasting import ForecastingEngine

    event = await db.get(Event, event_id)
    if event is None:
        raise NotFoundError(message="Event not found.")
    return await ForecastingEngine.predict_event_attendance(db, event)


@router.get("/analytics/peak-hours", summary="Get venue peak hours heatmap")
async def get_peak_hours(
    current_user: CurrentAdmin,
    db: DBSession,
):
    """Return a 7×24 heatmap of tap activity by weekday and hour."""
    from app.services.forecasting import ForecastingEngine
    return await ForecastingEngine.get_peak_hours(db)


@router.get("/analytics/segment-demand", summary="Get per-segment event demand statistics")
async def get_segment_demand(
    current_user: CurrentAdmin,
    db: DBSession,
):
    """Return average fill rate and trending direction per segment."""
    from app.services.forecasting import ForecastingEngine
    return await ForecastingEngine.get_segment_demand(db)


# ── Phase 6C: Churn Prediction ───────────────────────────────────────────────


@router.get("/analytics/churn", summary="Get club-wide churn risk overview")
async def get_churn_overview(
    current_user: CurrentAdmin,
    db: DBSession,
):
    """Return retention metrics and at-risk member list."""
    from app.services.churn import ChurnPredictionEngine
    return await ChurnPredictionEngine.get_retention_overview(db)


@router.get("/analytics/churn/{member_id}", summary="Get churn risk details for one member")
async def get_member_churn_detail(
    member_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    """Return detailed churn score breakdown with per-factor explanations."""
    from app.db.models.user import User as UserModel
    from app.core.exceptions import NotFoundError
    from app.services.churn import ChurnPredictionEngine

    member = await db.get(UserModel, member_id)
    if member is None:
        raise NotFoundError(message="Member not found.")
    score_data = await ChurnPredictionEngine.get_churn_score(db, member)
    return {
        "member_id": member.id,
        "full_name": member.full_name,
        **score_data,
    }


# ── QR Batch Generator ────────────────────────────────────────────────────────


@router.get("/qr-batches", response_model=list[QrBatchRead], summary="List QR batches")
async def list_qr_batches(
    current_user: CurrentAdmin,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    from app.services.qr_batch import list_batches
    from app.db.models.qr_batch import QrCode
    from sqlalchemy import select, func

    batches = await list_batches(db, skip=skip, limit=limit)
    result = []
    for batch in batches:
        conv_result = await db.execute(
            select(func.count()).select_from(QrCode).where(
                QrCode.batch_id == batch.id,
                QrCode.converted_at.is_not(None),
            )
        )
        converted = conv_result.scalar() or 0
        rate = round(converted / batch.count, 4) if batch.count > 0 else 0.0
        result.append(QrBatchRead(
            id=batch.id,
            promoter_id=batch.promoter_id,
            promo_code=batch.promo_code,
            tier=batch.tier,
            count=batch.count,
            prefix=batch.prefix,
            notes=batch.notes,
            created_by=batch.created_by,
            created_at=batch.created_at,
            conversion_rate=rate,
            converted_count=converted,
        ))
    return result


@router.post("/qr-batches", response_model=QrBatchRead, status_code=201, summary="Create QR batch")
async def create_qr_batch(
    batch_in: QrBatchCreate,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.services.qr_batch import create_batch
    batch = await create_batch(
        db,
        promoter_id=batch_in.promoter_id,
        promo_code=batch_in.promo_code,
        tier=batch_in.tier,
        count=batch_in.count,
        prefix=batch_in.prefix,
        notes=batch_in.notes,
        created_by=current_user.id,
    )
    return QrBatchRead(
        id=batch.id,
        promoter_id=batch.promoter_id,
        promo_code=batch.promo_code,
        tier=batch.tier,
        count=batch.count,
        prefix=batch.prefix,
        notes=batch.notes,
        created_by=batch.created_by,
        created_at=batch.created_at,
        conversion_rate=0.0,
        converted_count=0,
    )


@router.get("/qr-batches/{batch_id}", response_model=QrBatchDetail, summary="Get QR batch with codes")
async def get_qr_batch(
    batch_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.services.qr_batch import get_batch_with_codes
    from app.schemas.qr_batch import QrCodeRead
    from app.core.exceptions import NotFoundError

    result = await get_batch_with_codes(db, batch_id)
    if not result:
        raise NotFoundError(message="QR batch not found.")
    batch, codes = result
    converted_count = sum(1 for c in codes if c.converted_at)
    return QrBatchDetail(
        id=batch.id,
        promoter_id=batch.promoter_id,
        promo_code=batch.promo_code,
        tier=batch.tier,
        count=batch.count,
        prefix=batch.prefix,
        notes=batch.notes,
        created_by=batch.created_by,
        created_at=batch.created_at,
        conversion_rate=round(converted_count / batch.count, 4) if batch.count > 0 else 0.0,
        converted_count=converted_count,
        codes=[
            QrCodeRead(
                id=c.id,
                batch_id=c.batch_id,
                pass_id=c.pass_id,
                converted_at=c.converted_at,
                registered_user_id=c.registered_user_id,
                created_at=c.created_at,
            )
            for c in codes
        ],
    )


@router.get("/qr-batches/{batch_id}/pdf", summary="Download QR batch as PDF")
async def download_qr_batch_pdf(
    batch_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.services.qr_batch import get_batch_with_codes, generate_pdf
    from app.core.exceptions import NotFoundError

    result = await get_batch_with_codes(db, batch_id)
    if not result:
        raise NotFoundError(message="QR batch not found.")
    batch, codes = result
    pdf_bytes = generate_pdf(batch, codes, settings.FRONTEND_URL)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=qr-batch-{str(batch_id)[:8]}.pdf"},
    )


@router.get("/qr-batches/{batch_id}/png-zip", summary="Download QR batch as PNG ZIP (transparent background)")
async def download_qr_batch_png_zip(
    batch_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.services.qr_batch import get_batch_with_codes, generate_png_zip
    from app.core.exceptions import NotFoundError

    result = await get_batch_with_codes(db, batch_id)
    if not result:
        raise NotFoundError(message="QR batch not found.")
    batch, codes = result
    zip_bytes = generate_png_zip(batch, codes, settings.FRONTEND_URL)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=qr-batch-{str(batch_id)[:8]}.zip"},
    )


@router.post("/qr-batches/{batch_id}/append", response_model=QrBatchRead, summary="Append codes to existing QR batch")
async def append_qr_batch(
    batch_id: uuid.UUID,
    body: QrBatchModify,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.services.qr_batch import append_codes
    from app.core.exceptions import NotFoundError
    from app.db.models.qr_batch import QrCode as QrCodeModel
    from sqlalchemy import func, select

    batch = await append_codes(db, batch_id, body.count)
    if not batch:
        raise NotFoundError(message="QR batch not found.")
    conv_result = await db.execute(
        select(func.count()).select_from(QrCodeModel).where(
            QrCodeModel.batch_id == batch.id,
            QrCodeModel.converted_at.is_not(None),
        )
    )
    converted = conv_result.scalar() or 0
    return QrBatchRead(
        id=batch.id,
        promoter_id=batch.promoter_id,
        promo_code=batch.promo_code,
        tier=batch.tier,
        count=batch.count,
        prefix=batch.prefix,
        notes=batch.notes,
        created_by=batch.created_by,
        created_at=batch.created_at,
        conversion_rate=round(converted / batch.count, 4) if batch.count > 0 else 0.0,
        converted_count=converted,
    )


@router.post("/qr-batches/{batch_id}/reduce", response_model=QrBatchRead, summary="Remove unconverted codes from QR batch")
async def reduce_qr_batch(
    batch_id: uuid.UUID,
    body: QrBatchModify,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.services.qr_batch import reduce_codes
    from app.core.exceptions import NotFoundError
    from app.db.models.qr_batch import QrCode as QrCodeModel
    from sqlalchemy import func, select

    batch = await reduce_codes(db, batch_id, body.count)
    if not batch:
        raise NotFoundError(message="QR batch not found.")
    conv_result = await db.execute(
        select(func.count()).select_from(QrCodeModel).where(
            QrCodeModel.batch_id == batch.id,
            QrCodeModel.converted_at.is_not(None),
        )
    )
    converted = conv_result.scalar() or 0
    return QrBatchRead(
        id=batch.id,
        promoter_id=batch.promoter_id,
        promo_code=batch.promo_code,
        tier=batch.tier,
        count=batch.count,
        prefix=batch.prefix,
        notes=batch.notes,
        created_by=batch.created_by,
        created_at=batch.created_at,
        conversion_rate=round(converted / batch.count, 4) if batch.count > 0 else 0.0,
        converted_count=converted,
    )


@router.delete("/qr-batches/{batch_id}", status_code=204, summary="Delete QR batch (requires admin password)")
async def delete_qr_batch(
    batch_id: uuid.UUID,
    body: QrBatchDeleteRequest,
    current_user: CurrentAdmin,
    db: DBSession,
):
    from app.core.security import verify_password
    from app.core.exceptions import NotFoundError
    from app.db.models.qr_batch import QrBatch as QrBatchModel
    from fastapi import HTTPException
    from sqlalchemy import select

    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail="Incorrect password.")

    result = await db.execute(select(QrBatchModel).where(QrBatchModel.id == batch_id))
    qr_batch = result.scalar_one_or_none()
    if not qr_batch:
        raise NotFoundError(message="QR batch not found.")
    await db.delete(qr_batch)
    await db.commit()
