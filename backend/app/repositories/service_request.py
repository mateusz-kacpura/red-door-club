"""ServiceRequest repository functions."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.service_request import ServiceRequest


async def get_by_id(db: AsyncSession, request_id: uuid.UUID) -> ServiceRequest | None:
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    return result.scalar_one_or_none()


async def get_by_member(
    db: AsyncSession, member_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> list[ServiceRequest]:
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.member_id == member_id)
        .order_by(ServiceRequest.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_pending_today(db: AsyncSession) -> list[ServiceRequest]:
    from datetime import date, timedelta, timezone
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)
    result = await db.execute(
        select(ServiceRequest)
        .where(
            ServiceRequest.status.in_(["pending", "acknowledged", "in_progress"]),
            ServiceRequest.created_at >= today_start,
            ServiceRequest.created_at < today_end,
        )
        .order_by(ServiceRequest.created_at.asc())
    )
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    member_id: uuid.UUID,
    request_type: str,
    details: dict | None = None,
) -> ServiceRequest:
    req = ServiceRequest(
        member_id=member_id,
        request_type=request_type,
        details=details,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)
    return req


async def update(db: AsyncSession, req: ServiceRequest, update_data: dict) -> ServiceRequest:
    for field, value in update_data.items():
        setattr(req, field, value)
    if update_data.get("status") == "completed" and not req.completed_at:
        req.completed_at = datetime.utcnow()
    db.add(req)
    await db.flush()
    await db.refresh(req)
    return req


async def list_all(
    db: AsyncSession,
    status: str | None = None,
    request_type: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[ServiceRequest]:
    query = (
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.member), selectinload(ServiceRequest.assignee))
        .order_by(ServiceRequest.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if status:
        query = query.where(ServiceRequest.status == status)
    if request_type:
        query = query.where(ServiceRequest.request_type == request_type)
    result = await db.execute(query)
    return list(result.scalars().all())
