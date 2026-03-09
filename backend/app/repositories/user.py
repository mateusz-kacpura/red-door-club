
"""User repository (PostgreSQL async).

Contains only database operations. Business logic (password hashing,
validation) is handled by UserService in app/services/user.py.
"""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


async def get_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    """Get user by ID."""
    return await db.get(User, user_id)


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    """Get user by email."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_multi(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 100,
) -> list[User]:
    """Get multiple users with pagination."""
    result = await db.execute(select(User).offset(skip).limit(limit))
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    email: str,
    hashed_password: str | None,
    full_name: str | None = None,
    is_active: bool = True,
    is_superuser: bool = False,
    role: str = "user",
) -> User:
    """Create a new user.

    Note: Password should already be hashed by the service layer.
    """
    user = User(
        email=email,
        hashed_password=hashed_password,
        full_name=full_name,
        is_active=is_active,
        is_superuser=is_superuser,
        role=role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update(
    db: AsyncSession,
    *,
    db_user: User,
    update_data: dict,
) -> User:
    """Update a user.

    Note: If password needs updating, it should already be hashed.
    """
    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.add(db_user)
    await db.flush()
    await db.refresh(db_user)
    return db_user


async def delete(db: AsyncSession, user_id: UUID) -> User | None:
    """Delete a user."""
    user = await get_by_id(db, user_id)
    if user:
        await db.delete(user)
        await db.flush()
    return user


async def update_staff_notes(db: AsyncSession, user: User, notes: str | None) -> User:
    """Update staff notes on a member."""
    user.staff_notes = notes
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def get_connections_count(db: AsyncSession, member_id: UUID) -> int:
    """Count connections for a member (as either side)."""
    from app.db.models.connection import Connection
    count = await db.scalar(
        select(func.count()).select_from(Connection).where(
            or_(Connection.member_a_id == member_id, Connection.member_b_id == member_id)
        )
    )
    return count or 0


async def get_service_requests_count(db: AsyncSession, member_id: UUID) -> int:
    """Count service requests for a member."""
    from app.db.models.service_request import ServiceRequest
    count = await db.scalar(
        select(func.count()).select_from(ServiceRequest).where(
            ServiceRequest.member_id == member_id
        )
    )
    return count or 0


async def get_match_score_count(db: AsyncSession, user: User) -> int:
    """Count other active members who share at least 1 segment group (potential matches)."""
    if not user.segment_groups:
        return 0
    count = await db.scalar(
        select(func.count()).select_from(User).where(
            User.id != user.id,
            User.is_active == True,  # noqa: E712
            User.segment_groups.overlap(user.segment_groups),
        )
    )
    return count or 0
