"""Admin service — floor view, analytics, prep checklist, operations panel."""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.repositories import nfc as nfc_repo
from app.repositories import service_request as sr_repo
from app.repositories import tab as tab_repo
from app.repositories import user as user_repo


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

        return {
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
