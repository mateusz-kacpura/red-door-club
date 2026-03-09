"""Event repository functions."""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.event import Event, rsvp_table


async def get_by_id(db: AsyncSession, event_id: uuid.UUID) -> Event | None:
    result = await db.execute(select(Event).where(Event.id == event_id))
    return result.scalar_one_or_none()


async def get_published(
    db: AsyncSession,
    segments: list[str] | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Event]:
    query = select(Event).where(Event.status == "published")
    result = await db.execute(query.order_by(Event.starts_at.asc()).offset(skip).limit(limit))
    return list(result.scalars().all())


async def get_all(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[Event]:
    result = await db.execute(
        select(Event).order_by(Event.starts_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> Event:
    event = Event(**kwargs)
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def update(db: AsyncSession, event: Event, update_data: dict) -> Event:
    for field, value in update_data.items():
        setattr(event, field, value)
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def add_rsvp(db: AsyncSession, event_id: uuid.UUID, member_id: uuid.UUID) -> bool:
    existing = await db.execute(
        select(rsvp_table).where(
            rsvp_table.c.event_id == event_id,
            rsvp_table.c.member_id == member_id,
        )
    )
    if existing.first():
        return False
    await db.execute(
        rsvp_table.insert().values(
            event_id=event_id,
            member_id=member_id,
            rsvp_at=datetime.utcnow(),
        )
    )
    await db.flush()
    return True


async def remove_rsvp(db: AsyncSession, event_id: uuid.UUID, member_id: uuid.UUID) -> bool:
    result = await db.execute(
        rsvp_table.delete().where(
            rsvp_table.c.event_id == event_id,
            rsvp_table.c.member_id == member_id,
        )
    )
    await db.flush()
    return result.rowcount > 0


async def get_rsvp_count(db: AsyncSession, event_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(rsvp_table).where(rsvp_table.c.event_id == event_id)
    )
    return result.scalar_one() or 0


async def is_rsvped(db: AsyncSession, event_id: uuid.UUID, member_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(rsvp_table).where(
            rsvp_table.c.event_id == event_id,
            rsvp_table.c.member_id == member_id,
        )
    )
    return result.first() is not None
