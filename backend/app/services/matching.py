"""Matching engine service."""

from decimal import Decimal
from typing import List
from uuid import UUID

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


class MatchingEngine:
    """Calculates user segments based on profile data and tap events."""

    # Pairs where both sides benefit from an introduction (buyer/seller dynamics)
    COMPLEMENTARY_PAIRS: list[tuple[str, str]] = [
        ("Finance & Investors", "Tech & Founders"),
        ("Finance & Investors", "Real Estate"),
        ("Corporate Executives", "Legal & Advisory"),
        ("Tech & Founders", "Corporate Executives"),
    ]

    BUYER_SEGMENTS = {"Finance & Investors", "Corporate Executives", "Real Estate"}
    SELLER_SEGMENTS = {"Tech & Founders", "Legal & Advisory"}

    IN_VENUE_HOURS = 6
    RECENCY_DAYS = 7

    @staticmethod
    def calculate_segments(user: User) -> List[str]:
        """Evaluate user profile and return a list of segment groups."""
        segments = set()
        
        # Handle potentials Nones
        interests = [i.lower() for i in user.interests] if user.interests else []
        industry = user.industry.lower() if user.industry else ""
        revenue = user.revenue_range.lower() if user.revenue_range else ""
        
        # Finance & Investors
        if any(x in interests for x in ["finance", "investment"]) or "finance" in industry or "10m" in revenue:
            segments.add("Finance & Investors")
            
        # Tech & Founders
        if any(x in interests for x in ["technology", "startup", "tech"]) or "tech" in industry:
            segments.add("Tech & Founders")
            
        # Real Estate
        if any(x in interests for x in ["real estate", "property"]) or "real estate" in industry:
            segments.add("Real Estate")
            
        # Corporate Executives
        if "executive" in interests or "c-suite" in interests or "100" in revenue:
            segments.add("Corporate Executives")
            
        # Lifestyle & Leisure
        if any(x in interests for x in ["lifestyle", "luxury", "social"]):
            segments.add("Lifestyle & Leisure")
            
        # Legal & Advisory
        if any(x in interests for x in ["legal", "consulting", "advisory"]) or "legal" in industry:
            segments.add("Legal & Advisory")
            
        # International Network
        if "international" in interests or "import/export" in industry:
            segments.add("International Network")
            
        return list(segments)

    @staticmethod
    async def get_suggested_connections(
        db: AsyncSession,
        user: User,
        limit: int = 5,
    ) -> list[dict]:
        """Return top matches ranked by shared segment count, excluding existing connections."""
        from app.db.models.connection import Connection

        if not user.segment_groups:
            return []

        # Get IDs of already-connected members
        conn_result = await db.execute(
            select(Connection).where(
                or_(Connection.member_a_id == user.id, Connection.member_b_id == user.id)
            )
        )
        connections = conn_result.scalars().all()
        excluded_ids: set[UUID] = {user.id}
        for conn in connections:
            excluded_ids.add(conn.member_a_id)
            excluded_ids.add(conn.member_b_id)

        # Find other active members with overlapping segments
        result = await db.execute(
            select(User).where(
                User.id.notin_(excluded_ids),
                User.is_active == True,  # noqa: E712
                User.segment_groups.overlap(user.segment_groups),
            )
        )
        candidates: list[User] = list(result.scalars().all())

        # Score each candidate by shared segment count
        user_segments = set(user.segment_groups)
        scored = []
        for candidate in candidates:
            candidate_segments = set(candidate.segment_groups or [])
            shared = user_segments & candidate_segments
            scored.append({
                "member_id": str(candidate.id),
                "full_name": candidate.full_name,
                "tier": candidate.tier,
                "company_name": candidate.company_name,
                "industry": candidate.industry,
                "shared_segments": list(shared),
                "score": len(shared),
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]

    @staticmethod
    async def get_enhanced_suggestions(
        db: AsyncSession,
        user: User,
        limit: int = 10,
    ) -> list[dict]:
        """Return top matches with multi-factor AI scoring.

        Factors (weighted sum):
          shared_segments × 2.0, shared_events × 1.5, complementary_industry × 1.0,
          mutual_connection × 0.5, recency × 0.5, in_venue × 1.0
        SQL pre-filter keeps the candidate pool small for performance.
        """
        from datetime import datetime, timezone, timedelta
        from app.db.models.connection import Connection
        from app.db.models.nfc import TapEvent

        now = datetime.now(timezone.utc)
        six_hours_ago = now - timedelta(hours=MatchingEngine.IN_VENUE_HOURS)
        seven_days_ago = now - timedelta(days=MatchingEngine.RECENCY_DAYS)

        if not user.segment_groups:
            return []

        # Build excluded + connected ID sets
        conn_result = await db.execute(
            select(Connection).where(
                or_(Connection.member_a_id == user.id, Connection.member_b_id == user.id)
            )
        )
        connections = conn_result.scalars().all()
        excluded_ids: set[UUID] = {user.id}
        my_connection_ids: set[UUID] = set()
        for conn in connections:
            excluded_ids.add(conn.member_a_id)
            excluded_ids.add(conn.member_b_id)
            other = conn.member_b_id if conn.member_a_id == user.id else conn.member_a_id
            my_connection_ids.add(other)

        # SQL pre-filter: candidate must share ≥1 segment OR be currently in venue
        in_venue_subq = (
            select(TapEvent.member_id)
            .where(TapEvent.tapped_at >= six_hours_ago, TapEvent.member_id.isnot(None))
            .distinct()
            .scalar_subquery()
        )
        result = await db.execute(
            select(User).where(
                User.id.notin_(excluded_ids),
                User.is_active == True,  # noqa: E712
                or_(
                    User.segment_groups.overlap(user.segment_groups),
                    User.id.in_(in_venue_subq),
                ),
            )
        )
        candidates: list[User] = list(result.scalars().all())
        if not candidates:
            return []

        candidate_ids = [c.id for c in candidates]
        candidate_id_strs = [str(cid) for cid in candidate_ids]

        # Which candidates are currently in venue?
        venue_result = await db.execute(
            select(TapEvent.member_id).where(
                TapEvent.member_id.in_(candidate_ids),
                TapEvent.tapped_at >= six_hours_ago,
            ).distinct()
        )
        in_venue_ids: set[UUID] = set(venue_result.scalars().all())

        # Current user's event RSVPs
        my_events_result = await db.execute(
            text("SELECT event_id FROM event_rsvps WHERE member_id = :uid"),
            {"uid": str(user.id)},
        )
        my_event_id_strs: list[str] = [str(row[0]) for row in my_events_result.fetchall()]

        # Shared events per candidate (batch)
        shared_events_map: dict[str, int] = {}
        if my_event_id_strs and candidate_id_strs:
            ce_result = await db.execute(
                text(
                    "SELECT member_id::text, event_id::text FROM event_rsvps "
                    "WHERE member_id = ANY(:cids) AND event_id = ANY(:eids)"
                ),
                {"cids": candidate_id_strs, "eids": my_event_id_strs},
            )
            for row in ce_result.fetchall():
                mid = row[0]
                shared_events_map[mid] = shared_events_map.get(mid, 0) + 1

        # Mutual connections (friend-of-friend)
        mutual_conn_candidates: set[UUID] = set()
        if my_connection_ids:
            mutual_result = await db.execute(
                select(Connection).where(
                    or_(
                        Connection.member_a_id.in_(candidate_ids),
                        Connection.member_b_id.in_(candidate_ids),
                    ),
                    or_(
                        Connection.member_a_id.in_(my_connection_ids),
                        Connection.member_b_id.in_(my_connection_ids),
                    ),
                )
            )
            for conn in mutual_result.scalars().all():
                if conn.member_a_id in set(candidate_ids):
                    mutual_conn_candidates.add(conn.member_a_id)
                if conn.member_b_id in set(candidate_ids):
                    mutual_conn_candidates.add(conn.member_b_id)

        user_segments = set(user.segment_groups)
        scored: list[dict] = []
        for candidate in candidates:
            candidate_segments = set(candidate.segment_groups or [])
            shared = user_segments & candidate_segments
            cid_str = str(candidate.id)

            seg_score = len(shared) * 2.0
            events_count = shared_events_map.get(cid_str, 0)
            event_score = events_count * 1.5

            comp_score = 0.0
            for buyer_seg, seller_seg in MatchingEngine.COMPLEMENTARY_PAIRS:
                if (
                    (buyer_seg in user_segments and seller_seg in candidate_segments)
                    or (seller_seg in user_segments and buyer_seg in candidate_segments)
                ):
                    comp_score = 1.0
                    break

            mutual_score = 0.5 if candidate.id in mutual_conn_candidates else 0.0
            recency_score = (
                0.5
                if candidate.last_seen_at and candidate.last_seen_at.replace(tzinfo=candidate.last_seen_at.tzinfo or __import__("datetime").timezone.utc) >= seven_days_ago
                else 0.0
            )
            is_in_venue = candidate.id in in_venue_ids
            venue_score = 1.0 if is_in_venue else 0.0

            total_score = seg_score + event_score + comp_score + mutual_score + recency_score + venue_score

            reasons: list[str] = []
            if shared:
                reasons.append(f"Shares {', '.join(list(shared)[:2])}")
            if events_count > 0:
                reasons.append(f"{events_count} common event{'s' if events_count > 1 else ''}")
            if comp_score > 0:
                reasons.append("Complementary industries")
            if is_in_venue:
                reasons.append("In venue now")
            reason_text = " · ".join(reasons) if reasons else "Potential match"

            scored.append({
                "member_id": cid_str,
                "full_name": candidate.full_name,
                "tier": candidate.tier,
                "company_name": candidate.company_name,
                "industry": candidate.industry,
                "shared_segments": list(shared),
                "shared_events_count": events_count,
                "score": round(total_score, 2),
                "reason_text": reason_text,
                "is_in_venue": is_in_venue,
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]

    @staticmethod
    async def get_weekly_digest(db: AsyncSession, user: User) -> dict:
        """Return top 3 enhanced suggestions with actionable next steps."""
        from datetime import datetime, timezone

        top = await MatchingEngine.get_enhanced_suggestions(db, user, limit=3)
        next_steps: list[str] = []
        if not user.segment_groups:
            next_steps.append("tips.updateInterests")
        if len(top) < 3:
            next_steps.append("tips.completeProfileSuggestions")
        if not next_steps:
            next_steps.append("tips.tapNfcVenue")
        return {
            "top_suggestions": top,
            "next_steps": next_steps,
            "generated_at": datetime.now(timezone.utc),
        }

    @staticmethod
    async def get_deal_flow_pairs(db: AsyncSession, limit: int = 20) -> list[dict]:
        """Return buyer-seller pairs for staff introductions."""
        from app.db.models.connection import Connection

        buyer_segs = list(MatchingEngine.BUYER_SEGMENTS)
        seller_segs = list(MatchingEngine.SELLER_SEGMENTS)

        buyers_result = await db.execute(
            select(User).where(
                User.is_active == True,  # noqa: E712
                User.segment_groups.overlap(buyer_segs),
            )
        )
        buyers = buyers_result.scalars().all()

        sellers_result = await db.execute(
            select(User).where(
                User.is_active == True,  # noqa: E712
                User.segment_groups.overlap(seller_segs),
            )
        )
        sellers = sellers_result.scalars().all()

        # Build connection lookup
        all_conns_result = await db.execute(select(Connection))
        all_conns = all_conns_result.scalars().all()
        conn_set: set[tuple] = set()
        for c in all_conns:
            conn_set.add((c.member_a_id, c.member_b_id))
            conn_set.add((c.member_b_id, c.member_a_id))

        pairs: list[dict] = []
        seen: set[tuple] = set()
        for buyer in buyers:
            buyer_segs_set = set(buyer.segment_groups or [])
            for seller in sellers:
                if buyer.id == seller.id:
                    continue
                key = tuple(sorted([str(buyer.id), str(seller.id)]))
                if key in seen:
                    continue
                seen.add(key)

                seller_segs_set = set(seller.segment_groups or [])
                # Skip if they're already connected
                is_connected = (buyer.id, seller.id) in conn_set
                shared = buyer_segs_set & seller_segs_set
                is_complementary = bool(
                    buyer_segs_set & MatchingEngine.BUYER_SEGMENTS
                    and seller_segs_set & MatchingEngine.SELLER_SEGMENTS
                )
                if not is_complementary:
                    continue

                mutual = sum(
                    1
                    for conn in all_conns
                    if (conn.member_a_id == buyer.id or conn.member_b_id == buyer.id)
                    and (conn.member_a_id == seller.id or conn.member_b_id == seller.id)
                )
                score = round(
                    len(shared) * 0.5
                    + (1.0 if is_connected else 0.0)
                    + mutual * 0.3,
                    2,
                )
                pairs.append({
                    "buyer": {
                        "member_id": str(buyer.id),
                        "full_name": buyer.full_name,
                        "company_name": buyer.company_name,
                        "industry": buyer.industry,
                        "tier": buyer.tier,
                        "segments": list(buyer_segs_set & MatchingEngine.BUYER_SEGMENTS),
                    },
                    "seller": {
                        "member_id": str(seller.id),
                        "full_name": seller.full_name,
                        "company_name": seller.company_name,
                        "industry": seller.industry,
                        "tier": seller.tier,
                        "segments": list(seller_segs_set & MatchingEngine.SELLER_SEGMENTS),
                    },
                    "mutual_connections": mutual,
                    "score": score,
                })

        pairs.sort(key=lambda x: x["score"], reverse=True)
        return pairs[:limit]

    @staticmethod
    async def get_connection_gap_analysis(db: AsyncSession, user: User) -> dict:
        """Identify under-represented segment types in the member's network."""
        from app.db.models.connection import Connection

        user_segs = set(user.segment_groups or [])
        if not user_segs:
            return {
                "user_segments": [],
                "connected_segments": {},
                "missing_or_weak_segments": [],
                "priority_suggestions": [],
            }

        # Get all connected members
        conn_result = await db.execute(
            select(Connection).where(
                or_(Connection.member_a_id == user.id, Connection.member_b_id == user.id)
            )
        )
        connections = conn_result.scalars().all()
        connected_member_ids: list[UUID] = []
        for conn in connections:
            other = conn.member_b_id if conn.member_a_id == user.id else conn.member_a_id
            connected_member_ids.append(other)

        # Tally segment coverage
        connected_segments: dict[str, int] = {}
        if connected_member_ids:
            members_result = await db.execute(
                select(User).where(User.id.in_(connected_member_ids), User.is_active == True)  # noqa: E712
            )
            for m in members_result.scalars().all():
                for seg in (m.segment_groups or []):
                    connected_segments[seg] = connected_segments.get(seg, 0) + 1

        # Missing OR weak (< 2 connections in that segment)
        missing_or_weak = [
            seg for seg in user_segs
            if connected_segments.get(seg, 0) < 2
        ]

        # Get 1 priority suggestion per gap segment
        priority_suggestions: list[dict] = []
        for gap_seg in missing_or_weak[:5]:  # cap at 5 gaps
            suggestions = await MatchingEngine.get_enhanced_suggestions(db, user, limit=20)
            for s in suggestions:
                if gap_seg in s["shared_segments"]:
                    priority_suggestions.append(s)
                    break

        return {
            "user_segments": list(user_segs),
            "connected_segments": connected_segments,
            "missing_or_weak_segments": missing_or_weak,
            "priority_suggestions": priority_suggestions,
        }

    @staticmethod
    async def refresh_segment_scores(db: AsyncSession, user: User) -> None:
        """Recalculate and persist segment_groups after profile update."""
        new_segments = MatchingEngine.calculate_segments(user)
        user.segment_groups = new_segments
        db.add(user)

    @staticmethod
    async def generate_networking_report(
        db: AsyncSession,
        user: User,
    ) -> dict:
        """Generate a networking report for the member."""
        from app.db.models.connection import Connection
        from app.db.models.tab import Tab

        # Connection count
        conn_count = await db.scalar(
            select(func.count()).select_from(Connection).where(
                or_(Connection.member_a_id == user.id, Connection.member_b_id == user.id)
            )
        ) or 0

        # Total spent (all closed tabs)
        total_spent = await db.scalar(
            select(func.coalesce(func.sum(Tab.total_amount), 0)).where(
                Tab.member_id == user.id,
                Tab.status == "closed",
            )
        ) or Decimal("0.00")

        # Events attended (RSVP'd)
        from app.db.models.event import Event
        from sqlalchemy import text
        rsvp_result = await db.execute(
            text("SELECT COUNT(*) FROM event_rsvps WHERE member_id = :uid"),
            {"uid": user.id},
        )
        events_attended = rsvp_result.scalar() or 0

        # Top segments
        top_segments = user.segment_groups or []

        # Suggested next steps based on profile completeness (i18n keys)
        suggested_steps: list[str] = []
        if conn_count < 5:
            suggested_steps.append("tips.connectNfc")
        if not user.company_name:
            suggested_steps.append("tips.addCompany")
        if events_attended < 3:
            suggested_steps.append("tips.rsvpEvents")
        if not top_segments:
            suggested_steps.append("tips.updateInterests")
        if total_spent == 0:
            suggested_steps.append("tips.openTabExperience")
        if not suggested_steps:
            suggested_steps.append("tips.profileComplete")

        # Potential matches (segment overlap count)
        match_score_count = 0
        if user.segment_groups:
            match_score_count = await db.scalar(
                select(func.count()).select_from(User).where(
                    User.id != user.id,
                    User.is_active == True,  # noqa: E712
                    User.segment_groups.overlap(user.segment_groups),
                )
            ) or 0

        return {
            "connections_count": conn_count,
            "events_attended": int(events_attended),
            "total_spent": float(total_spent),
            "top_segments": top_segments,
            "suggested_next_steps": suggested_steps,
            "match_score_count": match_score_count,
        }
