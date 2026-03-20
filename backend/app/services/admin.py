"""Admin service — floor view, analytics, prep checklist, operations panel."""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Numeric

from app.db.models.user import User
from app.repositories import nfc as nfc_repo
from app.repositories import service_request as sr_repo
from app.repositories import tab as tab_repo
from app.repositories import user as user_repo

BANGKOK_TZ = ZoneInfo("Asia/Bangkok")


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_floor_view(self) -> list[dict]:
        """Return list of members currently in venue (venue_entry tap in last 8h)."""
        tap_events = await nfc_repo.get_recent_venue_entries(self.db, hours=8)

        # Deduplicate by member_id (keep most recent tap)
        seen: dict[uuid.UUID, dict] = {}
        for tap in tap_events:
            if tap.member_id and tap.member_id not in seen:
                seen[tap.member_id] = {
                    "member_id": str(tap.member_id),
                    "entry_time": tap.tapped_at.isoformat() if tap.tapped_at else None,
                    "location": tap.location,
                }

        # Enrich with member info
        result = []
        for member_id_str, entry in seen.items():
            user = await self.db.get(User, member_id_str if isinstance(member_id_str, uuid.UUID) else uuid.UUID(str(member_id_str)))
            if user:
                entry["full_name"] = user.full_name
                entry["company_name"] = user.company_name
                entry["tier"] = user.tier
            result.append(entry)

        return result

    async def get_analytics(self) -> dict:
        """Return KPI summary data."""
        from app.db.models.event import Event

        total_members = await self.db.scalar(
            select(func.count()).select_from(User).where(
                User.user_type == "member", User.is_active == True  # noqa: E712
            )
        )
        total_prospects = await self.db.scalar(
            select(func.count()).select_from(User).where(User.user_type == "prospect")
        )

        cutoff_24h = datetime.utcnow() - timedelta(hours=24)
        active_today = await self.db.scalar(
            select(func.count()).select_from(User).where(User.last_seen_at >= cutoff_24h)
        )

        cutoff_week = datetime.utcnow() - timedelta(days=7)
        events_this_week = await self.db.scalar(
            select(func.count()).select_from(Event).where(
                Event.starts_at >= cutoff_week,
                Event.status.in_(["published", "completed"]),
            )
        )

        return {
            "total_members": total_members or 0,
            "total_prospects": total_prospects or 0,
            "active_today": active_today or 0,
            "events_this_week": events_this_week or 0,
        }

    async def get_prep_checklist(self) -> list:
        return await sr_repo.get_pending_today(self.db)

    async def complete_checklist_item(self, request_id: uuid.UUID) -> dict:
        from app.core.exceptions import NotFoundError
        req = await sr_repo.get_by_id(self.db, request_id)
        if req is None:
            raise NotFoundError(message=f"Service request not found: {request_id}")
        await sr_repo.update(self.db, req, {"status": "completed"})
        return {"id": str(request_id), "status": "completed"}

    # ── Phase 3 methods ──────────────────────────────────────────────────────

    async def list_service_requests(
        self,
        status: str | None = None,
        request_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        """List all service requests with member and assignee names."""
        requests = await sr_repo.list_all(self.db, status, request_type, skip, limit)
        result = []
        for req in requests:
            data = {
                "id": str(req.id),
                "member_id": str(req.member_id),
                "member_name": req.member.full_name if req.member else None,
                "request_type": req.request_type,
                "status": req.status,
                "details": req.details,
                "assigned_to": str(req.assigned_to) if req.assigned_to else None,
                "assigned_to_name": req.assignee.full_name if req.assignee else None,
                "created_at": req.created_at.isoformat() if req.created_at else None,
                "completed_at": req.completed_at.isoformat() if req.completed_at else None,
                "member_rating": req.member_rating,
            }
            result.append(data)
        return result

    async def update_service_request(
        self,
        request_id: uuid.UUID,
        status: str | None,
        assigned_to: uuid.UUID | None,
        staff_notes: str | None,
    ) -> dict:
        """Update a service request status, assignment, and/or staff notes."""
        from app.core.exceptions import NotFoundError
        req = await sr_repo.get_by_id(self.db, request_id)
        if req is None:
            raise NotFoundError(message=f"Service request not found: {request_id}")

        update_data: dict = {}
        if status is not None:
            update_data["status"] = status
        if assigned_to is not None:
            update_data["assigned_to"] = assigned_to

        # Store staff_notes inside details JSON
        if staff_notes is not None:
            current_details = req.details or {}
            current_details["staff_notes"] = staff_notes
            update_data["details"] = current_details

        if update_data:
            req = await sr_repo.update(self.db, req, update_data)

        return {
            "id": str(req.id),
            "member_id": str(req.member_id),
            "request_type": req.request_type,
            "status": req.status,
            "details": req.details,
            "assigned_to": str(req.assigned_to) if req.assigned_to else None,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "completed_at": req.completed_at.isoformat() if req.completed_at else None,
            "member_rating": req.member_rating,
        }

    async def get_member_detail(self, member_id: uuid.UUID) -> dict:
        """Return full member detail for admin CRM view."""
        from app.core.exceptions import NotFoundError
        member = await user_repo.get_by_id(self.db, member_id)
        if member is None:
            raise NotFoundError(message=f"Member not found: {member_id}")

        connections_count = await user_repo.get_connections_count(self.db, member_id)
        service_requests_count = await user_repo.get_service_requests_count(self.db, member_id)

        # Total spent across all tabs
        tab_history = await tab_repo.get_tab_history(self.db, member_id, limit=50)
        tab_total = sum(
            (t.total_amount or Decimal("0.00")) for t in tab_history if t.status == "closed"
        )

        # NFC cards
        nfc_cards_raw = await nfc_repo.get_cards_by_member(self.db, member_id)
        nfc_cards = [
            {"card_id": c.card_id, "status": c.status, "tier_at_issue": c.tier_at_issue}
            for c in nfc_cards_raw
        ]

        # Recent taps
        recent_taps_raw = await nfc_repo.list_tap_events_by_member(self.db, member_id, limit=5)
        recent_taps = [
            {
                "id": str(t.id),
                "tap_type": t.tap_type,
                "location": t.location,
                "tapped_at": t.tapped_at.isoformat() if t.tapped_at else None,
            }
            for t in recent_taps_raw
        ]

        # Promoter stats + codes (only for promoters)
        promoter_stats: dict | None = None
        promoter_codes: list[dict] | None = None
        if member.is_promoter or member.user_type == "promoter":
            from app.services.promoter import PromoterService
            promoter_stats = await PromoterService.get_stats(self.db, member_id)

            from app.db.models.promoter import PromoCode
            codes_result = await self.db.execute(
                select(PromoCode)
                .where(PromoCode.promoter_id == member_id)
                .order_by(PromoCode.created_at.desc())
            )
            promoter_codes = [
                {
                    "id": str(c.id),
                    "code": c.code,
                    "tier_grant": c.tier_grant,
                    "quota": c.quota,
                    "uses_count": c.uses_count,
                    "reg_commission": float(c.reg_commission),
                    "checkin_commission_flat": float(c.checkin_commission_flat) if c.checkin_commission_flat is not None else None,
                    "checkin_commission_pct": float(c.checkin_commission_pct) if c.checkin_commission_pct is not None else None,
                    "is_active": c.is_active,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in codes_result.scalars().all()
            ]

        result = {
            "id": str(member.id),
            "email": member.email,
            "phone": member.phone,
            "full_name": member.full_name,
            "company_name": member.company_name,
            "industry": member.industry,
            "revenue_range": member.revenue_range,
            "interests": member.interests or [],
            "user_type": member.user_type,
            "tier": member.tier,
            "segment_groups": member.segment_groups or [],
            "pdpa_consent": member.pdpa_consent,
            "last_seen_at": member.last_seen_at.isoformat() if member.last_seen_at else None,
            "is_active": member.is_active,
            "is_superuser": member.is_superuser,
            "is_promoter": member.is_promoter,
            "role": member.role,
            "staff_notes": member.staff_notes,
            "created_at": member.created_at.isoformat() if hasattr(member, "created_at") and member.created_at else None,
            "updated_at": member.updated_at.isoformat() if hasattr(member, "updated_at") and member.updated_at else None,
            "connections_count": connections_count,
            "service_requests_count": service_requests_count,
            "tab_total": float(tab_total),
            "recent_taps": recent_taps,
            "nfc_cards": nfc_cards,
        }
        if promoter_stats is not None:
            result["promoter_stats"] = promoter_stats
        if promoter_codes is not None:
            result["promoter_codes"] = promoter_codes
        return result

    async def update_member_notes(self, member_id: uuid.UUID, notes: str | None) -> dict:
        """Update staff notes for a member."""
        from app.core.exceptions import NotFoundError
        member = await user_repo.get_by_id(self.db, member_id)
        if member is None:
            raise NotFoundError(message=f"Member not found: {member_id}")
        await user_repo.update_staff_notes(self.db, member, notes)
        return {"id": str(member_id), "staff_notes": notes}

    async def get_revenue_summary(self) -> dict:
        """Return revenue analytics from closed tabs."""
        return await tab_repo.get_revenue_summary(self.db)

    async def list_activity(
        self,
        tap_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        """Return paginated tap event log with member names."""
        events = await nfc_repo.list_tap_events(self.db, tap_type, skip, limit)
        result = []
        for event in events:
            result.append({
                "id": str(event.id),
                "member_id": str(event.member_id) if event.member_id else None,
                "member_name": event.member.full_name if event.member else None,
                "card_id": event.card_id,
                "tap_type": event.tap_type,
                "reader_id": event.reader_id,
                "location": event.location,
                "tapped_at": event.tapped_at.isoformat() if event.tapped_at else None,
                "metadata": event.metadata_,
            })
        return result

    async def get_staff_performance(self) -> dict:
        """Return staff performance analytics from QR checkin tap events."""
        from app.db.models.nfc import TapEvent

        now = datetime.now(BANGKOK_TZ)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        staff_id_col = TapEvent.metadata_["staff_id"].astext
        fee_col = func.coalesce(cast(TapEvent.metadata_["fee"].astext, Numeric), 0)

        base_filter = [
            TapEvent.tap_type == "qr_entry",
            staff_id_col.isnot(None),
            staff_id_col != "",
        ]

        # All-time stats per staff
        all_time_q = (
            select(
                staff_id_col.label("staff_id"),
                func.count(TapEvent.id).label("total_checkins"),
                func.coalesce(func.sum(fee_col), 0).label("total_revenue"),
                func.count(func.distinct(TapEvent.metadata_["event_id"].astext)).label("events_worked"),
            )
            .where(*base_filter)
            .group_by(staff_id_col)
        )
        all_time_result = await self.db.execute(all_time_q)
        all_time_rows = {str(r.staff_id): r for r in all_time_result.all()}

        # Month stats per staff
        month_q = (
            select(
                staff_id_col.label("staff_id"),
                func.count(TapEvent.id).label("month_checkins"),
                func.coalesce(func.sum(fee_col), 0).label("month_revenue"),
            )
            .where(*base_filter, TapEvent.tapped_at >= month_start)
            .group_by(staff_id_col)
        )
        month_result = await self.db.execute(month_q)
        month_rows = {str(r.staff_id): r for r in month_result.all()}

        # Today stats per staff
        today_q = (
            select(
                staff_id_col.label("staff_id"),
                func.count(TapEvent.id).label("today_checkins"),
            )
            .where(*base_filter, TapEvent.tapped_at >= today_start)
            .group_by(staff_id_col)
        )
        today_result = await self.db.execute(today_q)
        today_rows = {str(r.staff_id): r for r in today_result.all()}

        # Collect all staff IDs
        all_staff_ids = set(all_time_rows.keys())

        # Fetch staff names (LEFT JOIN style — handle deleted accounts)
        staff_names: dict[str, str] = {}
        if all_staff_ids:
            try:
                staff_uuids = [uuid.UUID(sid) for sid in all_staff_ids]
            except ValueError:
                staff_uuids = []

            if staff_uuids:
                name_result = await self.db.execute(
                    select(User.id, User.full_name).where(User.id.in_(staff_uuids))
                )
                for row in name_result.all():
                    staff_names[str(row.id)] = row.full_name or "Unknown"

        # Build per-staff list
        staff_list = []
        for sid in all_staff_ids:
            at = all_time_rows.get(sid)
            mt = month_rows.get(sid)
            td = today_rows.get(sid)

            total_checkins = at.total_checkins if at else 0
            events_worked = at.events_worked if at else 0
            avg_per_event = round(total_checkins / events_worked, 1) if events_worked > 0 else 0

            staff_list.append({
                "staff_id": sid,
                "full_name": staff_names.get(sid, "Unknown"),
                "today_checkins": td.today_checkins if td else 0,
                "month_checkins": mt.month_checkins if mt else 0,
                "month_revenue": float(mt.month_revenue) if mt else 0,
                "total_checkins": total_checkins,
                "total_revenue": float(at.total_revenue) if at else 0,
                "events_worked": events_worked,
                "avg_per_event": avg_per_event,
            })

        # Sort by month checkins descending
        staff_list.sort(key=lambda s: s["month_checkins"], reverse=True)

        # Add rank
        for i, s in enumerate(staff_list):
            s["rank"] = i + 1

        # Summary
        total_month_checkins = sum(s["month_checkins"] for s in staff_list)
        total_month_revenue = sum(s["month_revenue"] for s in staff_list)
        top_performer = staff_list[0]["full_name"] if staff_list else None

        return {
            "summary": {
                "total_staff": len(staff_list),
                "month_checkins": total_month_checkins,
                "month_revenue": total_month_revenue,
                "top_performer": top_performer,
            },
            "staff": staff_list,
        }
