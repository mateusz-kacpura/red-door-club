"""Locker repository functions."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.locker import Locker


async def get_by_number(db: AsyncSession, locker_number: str) -> Locker | None:
    result = await db.execute(select(Locker).where(Locker.locker_number == locker_number))
    return result.scalar_one_or_none()


async def get_by_member(db: AsyncSession, member_id: uuid.UUID) -> Locker | None:
    result = await db.execute(
        select(Locker).where(
            Locker.assigned_member_id == member_id,
            Locker.status == "occupied",
        )
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> list[Locker]:
    result = await db.execute(select(Locker).order_by(Locker.locker_number))
    return list(result.scalars().all())


async def create(db: AsyncSession, locker_number: str, location: str = "main_floor") -> Locker:
    locker = Locker(locker_number=locker_number, location=location, status="available")
    db.add(locker)
    await db.flush()
    await db.refresh(locker)
    return locker


async def assign(db: AsyncSession, locker: Locker, member_id: uuid.UUID) -> Locker:
    locker.status = "occupied"
    locker.assigned_member_id = member_id
    locker.assigned_at = datetime.utcnow()
    locker.released_at = None
    db.add(locker)
    await db.flush()
    await db.refresh(locker)
    return locker


async def release(db: AsyncSession, locker: Locker) -> Locker:
    locker.status = "available"
    locker.assigned_member_id = None
    locker.released_at = datetime.utcnow()
    db.add(locker)
    await db.flush()
    await db.refresh(locker)
    return locker
