"""NFC repository functions."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.nfc import NfcCard, TapEvent


async def get_card_by_card_id(db: AsyncSession, card_id: str) -> NfcCard | None:
    result = await db.execute(select(NfcCard).where(NfcCard.card_id == card_id))
    return result.scalar_one_or_none()


async def get_cards_by_member(db: AsyncSession, member_id: uuid.UUID) -> list[NfcCard]:
    result = await db.execute(select(NfcCard).where(NfcCard.member_id == member_id))
    return list(result.scalars().all())


async def create_card(db: AsyncSession, card_id: str, tier_at_issue: str | None = None) -> NfcCard:
    card = NfcCard(
        card_id=card_id,
        status="unbound",
        tier_at_issue=tier_at_issue,
        issued_at=datetime.utcnow(),
    )
    db.add(card)
    await db.flush()
    await db.refresh(card)
    return card


async def batch_create_cards(db: AsyncSession, cards: list[dict]) -> int:
    count = 0
    for card_data in cards:
        existing = await get_card_by_card_id(db, card_data["card_id"])
        if existing:
            continue
        card = NfcCard(
            card_id=card_data["card_id"],
            status="unbound",
            tier_at_issue=card_data.get("tier_at_issue"),
            issued_at=datetime.utcnow(),
        )
        db.add(card)
        count += 1
    await db.flush()
    return count


async def update_card(db: AsyncSession, card: NfcCard, **kwargs) -> NfcCard:
    for key, value in kwargs.items():
        setattr(card, key, value)
    db.add(card)
    await db.flush()
    await db.refresh(card)
    return card


async def log_tap_event(
    db: AsyncSession,
    card_id: str,
    tap_type: str,
    member_id: uuid.UUID | None = None,
    reader_id: str | None = None,
    location: str | None = None,
    metadata: dict | None = None,
) -> TapEvent:
    event = TapEvent(
        card_id=card_id,
        tap_type=tap_type,
        member_id=member_id,
        reader_id=reader_id,
        location=location,
        metadata_=metadata,
        tapped_at=datetime.utcnow(),
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def get_tap_history(
    db: AsyncSession,
    member_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> list[TapEvent]:
    result = await db.execute(
        select(TapEvent)
        .where(TapEvent.member_id == member_id)
        .order_by(TapEvent.tapped_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_recent_venue_entries(db: AsyncSession, hours: int = 8) -> list[TapEvent]:
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    result = await db.execute(
        select(TapEvent)
        .where(
            TapEvent.tap_type == "venue_entry",
            TapEvent.tapped_at >= cutoff,
            TapEvent.member_id.isnot(None),
        )
        .order_by(TapEvent.tapped_at.desc())
    )
    return list(result.scalars().all())


async def list_tap_events(
    db: AsyncSession,
    tap_type: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[TapEvent]:
    """Paginated list of all tap events, optionally filtered by tap_type."""
    query = (
        select(TapEvent)
        .options(selectinload(TapEvent.member))
        .order_by(TapEvent.tapped_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if tap_type:
        query = query.where(TapEvent.tap_type == tap_type)
    result = await db.execute(query)
    return list(result.scalars().all())


async def list_tap_events_by_member(
    db: AsyncSession,
    member_id: uuid.UUID,
    limit: int = 5,
) -> list[TapEvent]:
    """Recent tap events for a specific member."""
    result = await db.execute(
        select(TapEvent)
        .where(TapEvent.member_id == member_id)
        .order_by(TapEvent.tapped_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
