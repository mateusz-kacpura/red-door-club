"""Staff service — QR-based door checkin logic."""

import uuid
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AlreadyExistsError, NotFoundError
from app.db.models.nfc import TapEvent
from app.db.models.user import User
from app.repositories import event as event_repo
from app.repositories import nfc as nfc_repo
from app.repositories import tab as tab_repo
from app.schemas.event import EventRead
from app.services.loyalty import LoyaltyService

BANGKOK_TZ = ZoneInfo("Asia/Bangkok")


class StaffService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_member_for_checkin(self, member_id: uuid.UUID) -> dict:
        """Return member info needed for checkin display."""
        member = await self.db.get(User, member_id)
        if member is None or not member.is_active:
            raise NotFoundError(message="Member not found.")
        return {
            "id": str(member.id),
            "full_name": member.full_name,
            "tier": member.tier,
            "company_name": member.company_name,
            "is_active": member.is_active,
        }

    async def get_today_events(self) -> list[EventRead]:
        """Return today's published events."""
        events = await event_repo.get_published_today(self.db)
        return [EventRead.model_validate(e) for e in events]

    async def checkin(
        self,
        member_id: uuid.UUID,
        event_id: uuid.UUID,
        staff_id: uuid.UUID,
    ) -> dict:
        """Check in a member to an event via QR scan.

        1. Verify member & event
        2. Check duplicate
        3. Determine fee (PROMO or regular)
        4. Log tap event, add tab item, RSVP, award points
        """
        # 1. Verify member
        member = await self.db.get(User, member_id)
        if member is None or not member.is_active:
            raise NotFoundError(message="Member not found.")

        # 2. Verify event
        event = await event_repo.get_by_id(self.db, event_id)
        if event is None or event.status != "published":
            raise NotFoundError(message="Event not found.")

        # Check event is today (Asia/Bangkok)
        now = datetime.now(BANGKOK_TZ)
        event_date = event.starts_at.astimezone(BANGKOK_TZ).date()
        if event_date != now.date():
            raise NotFoundError(message="Event not found.")

        # 3. Check duplicate checkin for today
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(TapEvent).where(
                TapEvent.member_id == member_id,
                TapEvent.tap_type == "qr_entry",
                TapEvent.tapped_at >= day_start,
            )
        )
        existing_taps = result.scalars().all()
        for tap in existing_taps:
            if tap.metadata_ and tap.metadata_.get("event_id") == str(event_id):
                raise AlreadyExistsError(message="Already checked in to this event.")

        # 4. Determine fee
        is_promo = False
        fee = event.ticket_price or Decimal("0.00")

        if member.tier and member.tier.lower() == "vip":
            fee = Decimal("0.00")
            is_promo = True
        elif member.tier and member.tier.lower() in [t.lower() for t in (event.promo_tiers or [])]:
            fee = Decimal("0.00")
            is_promo = True

        # 5. Log tap event
        tap_event = await nfc_repo.log_tap_event(
            self.db,
            card_id=None,
            tap_type="qr_entry",
            member_id=member_id,
            metadata={
                "event_id": str(event_id),
                "event_title": event.title,
                "fee": str(fee),
                "is_promo": is_promo,
                "staff_id": str(staff_id),
            },
        )

        # 6. Add to tab (even if fee is 0, to record the entry)
        tab = await tab_repo.get_open_tab(self.db, member_id)
        if tab is None:
            tab = await tab_repo.create_tab(self.db, member_id)

        description = f"Entry: {event.title}"
        if is_promo:
            description += " (PROMO)"
        await tab_repo.add_item(self.db, tab, description, fee, tap_event_id=tap_event.id)

        # 6b. Record promoter commission for checkin (if member was referred)
        try:
            from app.services.promoter import PromoterService
            await PromoterService.record_checkin_commission(self.db, member, fee)
        except Exception:
            pass  # promoter commission failure must not block checkin

        # 7. RSVP if not already
        await event_repo.add_rsvp(self.db, event_id, member_id)

        # 8. Award loyalty points (calls db.commit() internally — must be last)
        await LoyaltyService.award_points(
            self.db,
            member_id=member_id,
            reason="event_attendance",
            reference_id=tap_event.id,
        )

        return {
            "status": "checked_in",
            "member_name": member.full_name or "Member",
            "event_title": event.title,
            "fee": str(fee),
            "is_promo": is_promo,
        }
