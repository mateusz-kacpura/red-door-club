"""Churn prediction engine for member retention analytics."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


def _risk_level(score: int) -> str:
    if score <= 20:
        return "healthy"
    if score <= 40:
        return "low"
    if score <= 60:
        return "medium"
    if score <= 80:
        return "high"
    return "critical"


class ChurnPredictionEngine:
    """Heuristic churn scoring — no external ML dependencies.

    Score 0–100 (higher = higher churn risk).
    Max raw sum = 120; clamped to 100 at the end.
    """

    @staticmethod
    async def get_churn_score(db: AsyncSession, member: User) -> dict:
        """Compute churn score and risk factors for one member."""
        now = datetime.now(timezone.utc)
        factors: list[dict] = []
        raw_score = 0

        # ── Factor 1: Days since last seen ──────────────────────────────────
        last_seen = member.last_seen_at
        if last_seen:
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            days_away = (now - last_seen).days
        else:
            days_away = 999  # never seen

        if days_away <= 0:
            dsls_score = 0
            dsls_detail = "Active today"
        elif days_away <= 30:
            dsls_score = 10
            dsls_detail = f"Last seen {days_away}d ago"
        elif days_away <= 60:
            dsls_score = 30
            dsls_detail = f"Last seen {days_away}d ago"
        elif days_away <= 90:
            dsls_score = 50
            dsls_detail = f"Last seen {days_away}d ago"
        else:
            dsls_score = 70
            dsls_detail = f"Last seen {days_away}d ago (very long absence)"
        raw_score += dsls_score
        factors.append({"name": "days_since_last_seen", "impact": dsls_score, "detail": dsls_detail})

        # ── Factor 2: Tap frequency decline ─────────────────────────────────
        from app.db.models.nfc import TapEvent

        d30_ago = now - timedelta(days=30)
        d60_ago = now - timedelta(days=60)

        taps_recent = await db.scalar(
            select(func.count()).select_from(TapEvent).where(
                TapEvent.member_id == member.id,
                TapEvent.tapped_at >= d30_ago,
            )
        ) or 0
        taps_prev = await db.scalar(
            select(func.count()).select_from(TapEvent).where(
                TapEvent.member_id == member.id,
                TapEvent.tapped_at >= d60_ago,
                TapEvent.tapped_at < d30_ago,
            )
        ) or 0

        if taps_prev > 0:
            decline_pct = (taps_prev - taps_recent) / taps_prev
        else:
            decline_pct = 0.0 if taps_recent > 0 else 0.5  # no history = moderate risk

        if decline_pct > 0.8:
            tap_score = 25
            tap_detail = f"Tap frequency dropped >{int(decline_pct*100)}% vs previous month"
        elif decline_pct > 0.5:
            tap_score = 15
            tap_detail = f"Tap frequency dropped {int(decline_pct*100)}% vs previous month"
        else:
            tap_score = 0
            tap_detail = "Tap activity stable or growing"
        raw_score += tap_score
        factors.append({"name": "tap_frequency_decline", "impact": tap_score, "detail": tap_detail})

        # ── Factor 3: No loyalty earning in 30 days ──────────────────────────
        from app.db.models.loyalty import LoyaltyTransaction

        recent_earning = await db.scalar(
            select(func.count()).select_from(LoyaltyTransaction).where(
                LoyaltyTransaction.member_id == member.id,
                LoyaltyTransaction.points > 0,
                LoyaltyTransaction.created_at >= d30_ago,
            )
        ) or 0
        if recent_earning == 0:
            loyalty_score = 10
            loyalty_detail = "No loyalty points earned in last 30 days"
        else:
            loyalty_score = 0
            loyalty_detail = f"{recent_earning} loyalty transactions in last 30 days"
        raw_score += loyalty_score
        factors.append({"name": "loyalty_earning", "impact": loyalty_score, "detail": loyalty_detail})

        # ── Factor 4: No event RSVP in 60 days ──────────────────────────────
        d60_ago_str = d60_ago.isoformat()
        rsvp_result = await db.execute(
            text(
                "SELECT COUNT(*) FROM event_rsvps er "
                "JOIN events e ON e.id = er.event_id "
                "WHERE er.member_id = :uid AND e.starts_at >= :since"
            ),
            {"uid": str(member.id), "since": d60_ago_str},
        )
        recent_rsvps = rsvp_result.scalar() or 0
        if recent_rsvps == 0:
            rsvp_score = 10
            rsvp_detail = "No event RSVPs in last 60 days"
        else:
            rsvp_score = 0
            rsvp_detail = f"{recent_rsvps} event RSVP(s) in last 60 days"
        raw_score += rsvp_score
        factors.append({"name": "event_rsvp_activity", "impact": rsvp_score, "detail": rsvp_detail})

        # ── Factor 5: Zero spending in last 30 days ──────────────────────────
        from app.db.models.tab import Tab

        recent_spending = await db.scalar(
            select(func.coalesce(func.sum(Tab.total_amount), 0)).where(
                Tab.member_id == member.id,
                Tab.closed_at >= d30_ago,
                Tab.status == "closed",
            )
        ) or 0
        if float(recent_spending) == 0:
            spend_score = 5
            spend_detail = "No spending recorded in last 30 days"
        else:
            spend_score = 0
            spend_detail = f"฿{float(recent_spending):,.2f} spent in last 30 days"
        raw_score += spend_score
        factors.append({"name": "spending_activity", "impact": spend_score, "detail": spend_detail})

        final_score = min(raw_score, 100)
        risk = _risk_level(final_score)

        # Recommendation
        primary = max(factors, key=lambda f: f["impact"])
        if risk in ("high", "critical"):
            recommendation = f"Priority: reach out personally. Main concern: {primary['detail'].lower()}."
        elif risk == "medium":
            recommendation = "Send a re-engagement message. Offer upcoming event invitations."
        else:
            recommendation = "Member is active. Continue regular engagement."

        return {
            "score": final_score,
            "risk_level": risk,
            "factors": factors,
            "recommendation": recommendation,
        }

    @staticmethod
    async def get_at_risk_members(
        db: AsyncSession,
        min_score: int = 40,
        limit: int = 20,
    ) -> list[dict]:
        """Return top at-risk active members sorted by churn score descending."""
        result = await db.execute(
            select(User).where(User.is_active == True, User.is_superuser == False)  # noqa: E712
        )
        members = result.scalars().all()

        scored: list[dict] = []
        for member in members:
            score_data = await ChurnPredictionEngine.get_churn_score(db, member)
            if score_data["score"] >= min_score:
                primary_factor = max(score_data["factors"], key=lambda f: f["impact"])
                scored.append({
                    "member_id": member.id,
                    "full_name": member.full_name,
                    "tier": member.tier,
                    "company_name": member.company_name,
                    "churn_score": score_data["score"],
                    "risk_level": score_data["risk_level"],
                    "last_seen_at": member.last_seen_at,
                    "primary_risk_factor": primary_factor["detail"],
                })

        scored.sort(key=lambda x: x["churn_score"], reverse=True)
        return scored[:limit]

    @staticmethod
    async def get_retention_overview(db: AsyncSession) -> dict:
        """Return club-wide retention metrics."""
        now = datetime.now(timezone.utc)
        d30_ago = now - timedelta(days=30)

        total = await db.scalar(
            select(func.count()).select_from(User).where(
                User.is_active == True, User.is_superuser == False  # noqa: E712
            )
        ) or 0

        active_30d = await db.scalar(
            select(func.count()).select_from(User).where(
                User.is_active == True,  # noqa: E712
                User.is_superuser == False,  # noqa: E712
                User.last_seen_at >= d30_ago,
            )
        ) or 0

        retention_rate = round(active_30d / total * 100, 1) if total > 0 else 0.0

        # Sample churn scores (up to 100 members for performance)
        result = await db.execute(
            select(User)
            .where(User.is_active == True, User.is_superuser == False)  # noqa: E712
            .limit(100)
        )
        sample = result.scalars().all()

        dist: dict[str, int] = {"healthy": 0, "low": 0, "medium": 0, "high": 0, "critical": 0}
        total_score = 0
        at_risk: list[dict] = []

        for member in sample:
            score_data = await ChurnPredictionEngine.get_churn_score(db, member)
            s = score_data["score"]
            r = score_data["risk_level"]
            total_score += s
            dist[r] = dist.get(r, 0) + 1
            if s >= 40:
                primary_factor = max(score_data["factors"], key=lambda f: f["impact"])
                at_risk.append({
                    "member_id": member.id,
                    "full_name": member.full_name,
                    "tier": member.tier,
                    "company_name": member.company_name,
                    "churn_score": s,
                    "risk_level": r,
                    "last_seen_at": member.last_seen_at,
                    "primary_risk_factor": primary_factor["detail"],
                })

        avg_score = round(total_score / len(sample), 1) if sample else 0.0
        at_risk.sort(key=lambda x: x["churn_score"], reverse=True)

        return {
            "retention_rate_30d": retention_rate,
            "avg_churn_score": avg_score,
            "total_members": total,
            "active_30d": active_30d,
            "risk_distribution": dist,
            "at_risk_members": at_risk[:20],
        }
