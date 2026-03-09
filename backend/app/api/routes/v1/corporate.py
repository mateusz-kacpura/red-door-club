"""Corporate account routes (admin-only)."""

import uuid

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentAdmin, DBSession
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.models.corporate import CorporateAccount, CorporateMember
from app.db.models.user import User
from app.schemas.corporate import (
    PACKAGE_SEAT_LIMITS,
    AddCorporateMemberRequest,
    CorporateAccountCreate,
    CorporateAccountRead,
    CorporateAccountUpdate,
    CorporateMemberRead,
)

router = APIRouter()


@router.get("", summary="List all corporate accounts")
async def list_corporate(
    current_user: CurrentAdmin,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    result = await db.execute(
        select(CorporateAccount)
        .order_by(CorporateAccount.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    accounts = result.scalars().all()
    return [CorporateAccountRead.model_validate(a) for a in accounts]


@router.post("", status_code=201, summary="Create corporate account")
async def create_corporate(
    current_user: CurrentAdmin,
    db: DBSession,
    payload: CorporateAccountCreate,
):
    max_seats = PACKAGE_SEAT_LIMITS.get(payload.package_type, 5)
    account = CorporateAccount(
        company_name=payload.company_name,
        billing_contact_name=payload.billing_contact_name,
        billing_contact_email=payload.billing_contact_email,
        billing_address=payload.billing_address,
        vat_number=payload.vat_number,
        package_type=payload.package_type,
        max_seats=max_seats,
        annual_fee=payload.annual_fee,
        renewal_date=payload.renewal_date,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return CorporateAccountRead.model_validate(account)


@router.get("/{account_id}", summary="Get corporate account detail")
async def get_corporate(
    account_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    account = await db.get(CorporateAccount, account_id)
    if account is None:
        raise NotFoundError(message="Corporate account not found.")

    # Load members with user info
    result = await db.execute(
        select(CorporateMember, User.full_name, User.email)
        .join(User, CorporateMember.member_id == User.id, isouter=True)
        .where(CorporateMember.corporate_id == account_id, CorporateMember.is_active == True)  # noqa: E712
    )
    rows = result.all()

    members_out = []
    for cm, full_name, email in rows:
        m = CorporateMemberRead.model_validate(cm)
        m.member_name = full_name
        m.member_email = email
        members_out.append(m)

    return {
        **CorporateAccountRead.model_validate(account).model_dump(),
        "members": [m.model_dump() for m in members_out],
    }


@router.patch("/{account_id}", summary="Update corporate account")
async def update_corporate(
    account_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
    payload: CorporateAccountUpdate,
):
    account = await db.get(CorporateAccount, account_id)
    if account is None:
        raise NotFoundError(message="Corporate account not found.")

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(account, field, value)
    if "package_type" in update_data:
        account.max_seats = PACKAGE_SEAT_LIMITS.get(update_data["package_type"], account.max_seats)
    await db.commit()
    await db.refresh(account)
    return CorporateAccountRead.model_validate(account)


@router.post("/{account_id}/members", status_code=201, summary="Add member to corporate account by email")
async def add_corporate_member(
    account_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
    payload: AddCorporateMemberRequest,
):
    account = await db.get(CorporateAccount, account_id)
    if account is None:
        raise NotFoundError(message="Corporate account not found.")

    if account.active_seats >= account.max_seats:
        raise BadRequestError(message=f"Seat limit reached ({account.max_seats}).")

    user_result = await db.execute(select(User).where(User.email == payload.email))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(message=f"No member with email {payload.email}.")

    cm = CorporateMember(corporate_id=account_id, member_id=user.id)
    db.add(cm)
    account.active_seats += 1
    await db.commit()
    await db.refresh(cm)
    result = CorporateMemberRead.model_validate(cm)
    result.member_name = user.full_name
    result.member_email = user.email
    return result


@router.delete("/{account_id}/members/{member_id}", status_code=200, summary="Remove member from corporate account")
async def remove_corporate_member(
    account_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: CurrentAdmin,
    db: DBSession,
):
    result = await db.execute(
        select(CorporateMember).where(
            CorporateMember.corporate_id == account_id,
            CorporateMember.member_id == member_id,
        )
    )
    cm = result.scalar_one_or_none()
    if cm is None:
        raise NotFoundError(message="Member not found in this account.")
    cm.is_active = False
    account = await db.get(CorporateAccount, account_id)
    if account and account.active_seats > 0:
        account.active_seats -= 1
    await db.commit()
    return {"removed": True}
