"""Promoter service — promo code management and attribution."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.models.promoter import PayoutRequest, PromoCode, PromoCodeUse
from app.db.models.user import User


class PromoterService:
    """Handles promo code validation, commission tracking, and payout workflows."""

    @staticmethod
    async def validate_and_apply_code(
        db: AsyncSession,
        code_str: str,
        user: User,
        tier_override: str | None = None,
    ) -> PromoCode | None:
        """Validate a promo code and apply it to a newly registered user.

        Updates:
        - user.referred_by_code
        - user.tier (if code has tier_grant or tier_override provided)
        - promo_code.uses_count
        - Creates PromoCodeUse record

        Returns None if the code is not found or inactive.
        """
        result = await db.execute(
            select(PromoCode).where(PromoCode.code == code_str.upper(), PromoCode.is_active == True)  # noqa: E712
        )
        promo = result.scalar_one_or_none()
        if promo is None:
            return None

        # Check quota
        if promo.quota > 0 and promo.uses_count >= promo.quota:
            return None

        # Apply tier grant
        effective_tier = tier_override or promo.tier_grant
        if effective_tier and not user.tier:
            user.tier = effective_tier

        # Record referral
        user.referred_by_code = promo.code

        # Bump counter
        promo.uses_count += 1

        # Create use record
        use = PromoCodeUse(
            code_id=promo.id,
            user_id=user.id,
        )
        db.add(use)
        await db.commit()
        return promo

    @staticmethod
    async def get_stats(db: AsyncSession, promoter_id: UUID) -> dict:
        """Return aggregate stats for a promoter."""
        codes_result = await db.execute(
            select(PromoCode).where(PromoCode.promoter_id == promoter_id)
        )
        codes = list(codes_result.scalars().all())

        total_uses = sum(c.uses_count for c in codes)
        total_revenue = sum(c.revenue_attributed for c in codes)
        commission_earned = sum(c.revenue_attributed * c.commission_rate for c in codes)

        # Pending payout
        pending_result = await db.scalar(
            select(func.coalesce(func.sum(PayoutRequest.amount), 0)).where(
                PayoutRequest.promoter_id == promoter_id,
                PayoutRequest.status == "pending",
            )
        ) or Decimal("0.00")

        return {
            "total_codes": len(codes),
            "total_uses": total_uses,
            "total_revenue": float(total_revenue),
            "commission_earned": float(commission_earned),
            "pending_payout": float(pending_result),
        }

    @staticmethod
    async def get_leaderboard(db: AsyncSession, limit: int = 10) -> list[dict]:
        """Return top promoters by conversion count."""
        result = await db.execute(
            select(
                User.id,
                User.full_name,
                User.company_name,
                func.sum(PromoCode.uses_count).label("total_uses"),
                func.sum(PromoCode.revenue_attributed).label("total_revenue"),
            )
            .join(PromoCode, PromoCode.promoter_id == User.id)
            .where(User.is_promoter == True)  # noqa: E712
            .group_by(User.id, User.full_name, User.company_name)
            .order_by(func.sum(PromoCode.uses_count).desc())
            .limit(limit)
        )
        rows = result.all()
        return [
            {
                "rank": i + 1,
                "promoter_id": str(row.id),
                "full_name": row.full_name,
                "company_name": row.company_name,
                "total_uses": row.total_uses or 0,
                "total_revenue": float(row.total_revenue or 0),
            }
            for i, row in enumerate(rows)
        ]

    @staticmethod
    async def request_payout(
        db: AsyncSession,
        promoter_id: UUID,
        amount: Decimal,
    ) -> PayoutRequest:
        """Create a payout request for a promoter."""
        if amount <= 0:
            raise BadRequestError(message="Payout amount must be positive.")
        payout = PayoutRequest(promoter_id=promoter_id, amount=amount, status="pending")
        db.add(payout)
        await db.commit()
        await db.refresh(payout)
        return payout

    @staticmethod
    async def approve_payout(
        db: AsyncSession,
        payout_id: UUID,
        notes: str | None = None,
    ) -> PayoutRequest:
        """Mark a payout request as paid."""
        from datetime import datetime, timezone
        payout = await db.get(PayoutRequest, payout_id)
        if payout is None:
            raise NotFoundError(message="Payout request not found.")
        payout.status = "paid"
        payout.notes = notes
        payout.processed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(payout)
        return payout
