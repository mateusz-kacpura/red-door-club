"""Tab repository functions."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.tab import Tab, TabItem


async def get_open_tab(db: AsyncSession, member_id: uuid.UUID) -> Tab | None:
    result = await db.execute(
        select(Tab)
        .where(Tab.member_id == member_id, Tab.status == "open")
        .options(selectinload(Tab.items))
    )
    return result.scalar_one_or_none()


async def create_tab(db: AsyncSession, member_id: uuid.UUID) -> Tab:
    tab = Tab(
        member_id=member_id,
        status="open",
        opened_at=datetime.utcnow(),
        total_amount=Decimal("0.00"),
    )
    db.add(tab)
    await db.flush()
    await db.refresh(tab)
    return tab


async def add_item(
    db: AsyncSession,
    tab: Tab,
    description: str,
    amount: Decimal,
    tap_event_id: uuid.UUID | None = None,
) -> TabItem:
    item = TabItem(
        tab_id=tab.id,
        description=description,
        amount=amount,
        added_at=datetime.utcnow(),
        tap_event_id=tap_event_id,
    )
    db.add(item)
    tab.total_amount = (tab.total_amount or Decimal("0.00")) + amount
    db.add(tab)
    await db.flush()
    await db.refresh(item)
    return item


async def close_tab(db: AsyncSession, tab: Tab) -> Tab:
    tab.status = "closed"
    tab.closed_at = datetime.utcnow()
    db.add(tab)
    await db.flush()
    await db.refresh(tab)
    return tab


async def get_tab_history(db: AsyncSession, member_id: uuid.UUID, limit: int = 10) -> list[Tab]:
    result = await db.execute(
        select(Tab)
        .where(Tab.member_id == member_id)
        .options(selectinload(Tab.items))
        .order_by(Tab.opened_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_open_tabs(db: AsyncSession) -> list[Tab]:
    result = await db.execute(
        select(Tab)
        .where(Tab.status == "open")
        .options(selectinload(Tab.items))
        .order_by(Tab.opened_at.desc())
    )
    return list(result.scalars().all())


async def get_tab_by_id(db: AsyncSession, tab_id: uuid.UUID) -> Tab | None:
    result = await db.execute(
        select(Tab).where(Tab.id == tab_id).options(selectinload(Tab.items))
    )
    return result.scalar_one_or_none()


async def get_revenue_summary(db: AsyncSession) -> dict:
    """Return revenue totals (today, this_week, this_month) from closed tabs, plus top 5 spenders."""
    from app.db.models.user import User

    now = datetime.now(tz=timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    async def _sum(since: datetime) -> Decimal:
        val = await db.scalar(
            select(func.coalesce(func.sum(Tab.total_amount), Decimal("0.00")))
            .where(Tab.status == "closed", Tab.closed_at >= since)
        )
        return val or Decimal("0.00")

    today_rev = await _sum(today_start)
    week_rev = await _sum(week_start)
    month_rev = await _sum(month_start)

    # Top 5 spenders (all time from closed tabs)
    rows = await db.execute(
        select(Tab.member_id, func.sum(Tab.total_amount).label("total"))
        .where(Tab.status == "closed")
        .group_by(Tab.member_id)
        .order_by(func.sum(Tab.total_amount).desc())
        .limit(5)
    )
    top_rows = rows.all()

    top_spenders = []
    for row in top_rows:
        member_id, total = row
        user = await db.get(User, member_id)
        top_spenders.append({
            "member_id": str(member_id),
            "full_name": user.full_name if user else None,
            "total_spent": total or Decimal("0.00"),
        })

    return {
        "today": today_rev,
        "this_week": week_rev,
        "this_month": month_rev,
        "top_spenders": top_spenders,
    }
