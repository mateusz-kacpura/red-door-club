"""Connection repository functions."""

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.connection import Connection


async def exists(db: AsyncSession, member_a_id: uuid.UUID, member_b_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Connection).where(
            or_(
                (Connection.member_a_id == member_a_id) & (Connection.member_b_id == member_b_id),
                (Connection.member_a_id == member_b_id) & (Connection.member_b_id == member_a_id),
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def create(
    db: AsyncSession,
    member_a_id: uuid.UUID,
    member_b_id: uuid.UUID,
    connection_type: str = "tap",
    tap_event_id: uuid.UUID | None = None,
) -> Connection:
    conn = Connection(
        member_a_id=member_a_id,
        member_b_id=member_b_id,
        connection_type=connection_type,
        tap_event_id=tap_event_id,
    )
    db.add(conn)
    await db.flush()
    await db.refresh(conn)
    return conn


async def get_by_member(
    db: AsyncSession,
    member_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> list[Connection]:
    result = await db.execute(
        select(Connection)
        .where(
            or_(
                Connection.member_a_id == member_id,
                Connection.member_b_id == member_id,
            )
        )
        .order_by(Connection.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())
