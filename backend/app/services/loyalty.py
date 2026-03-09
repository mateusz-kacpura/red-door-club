"""Loyalty & RD Points service."""

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.models.loyalty import LoyaltyTransaction
from app.db.models.user import User


class LoyaltyService:
    """Handles point earning, spending, and reporting."""

    EARN_RATES: dict[str, int] = {
        "event_attendance": 50,
        "service_request": 20,
        "guest_referral": 100,
        "podcast_recording": 150,
        "manual_award": 0,  # amount provided explicitly
    }

    # Redemption catalogue (label → cost in points)
    REDEMPTION_OPTIONS: list[dict] = [
        {"id": "event_ticket", "label": "Event Ticket", "points": 150},
        {"id": "car_booking", "label": "Car Booking", "points": 200},
        {"id": "studio_session", "label": "Studio Session", "points": 300},
    ]

    @staticmethod
    async def award_points(
        db: AsyncSession,
        member_id: UUID,
        reason: str,
        points: int | None = None,
        reference_id: UUID | None = None,
    ) -> LoyaltyTransaction:
        """Award points to a member.

        If *points* is None the class-level earn rate for *reason* is used.
        Raises ValueError for unknown reasons when points is also None.
        """
        if points is None:
            pts = LoyaltyService.EARN_RATES.get(reason)
            if pts is None:
                raise ValueError(f"Unknown loyalty reason: {reason!r}")
        else:
            pts = points

        if pts <= 0:
            raise BadRequestError(message="Points amount must be positive for an award.")

        tx = LoyaltyTransaction(
            member_id=member_id,
            points=pts,
            reason=reason,
            reference_id=reference_id,
        )
        db.add(tx)

        # Update running totals on the user row
        await db.execute(
            update(User)
            .where(User.id == member_id)
            .values(
                loyalty_points=User.loyalty_points + pts,
                loyalty_lifetime_points=User.loyalty_lifetime_points + pts,
            )
        )
        await db.commit()
        await db.refresh(tx)
        return tx

    @staticmethod
    async def redeem_points(
        db: AsyncSession,
        member_id: UUID,
        amount: int,
        reason: str = "redemption",
    ) -> LoyaltyTransaction:
        """Deduct *amount* points from a member's balance (redemption).

        Raises BadRequestError if the member has insufficient balance.
        """
        if amount <= 0:
            raise BadRequestError(message="Redemption amount must be positive.")

        result = await db.execute(select(User).where(User.id == member_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError(message=f"Member {member_id} not found.")
        if user.loyalty_points < amount:
            raise BadRequestError(
                message=f"Insufficient points: have {user.loyalty_points}, need {amount}."
            )

        tx = LoyaltyTransaction(
            member_id=member_id,
            points=-amount,  # negative = spent
            reason=reason,
        )
        db.add(tx)

        await db.execute(
            update(User)
            .where(User.id == member_id)
            .values(loyalty_points=User.loyalty_points - amount)
        )
        await db.commit()
        await db.refresh(tx)
        return tx

    @staticmethod
    async def get_balance(db: AsyncSession, member_id: UUID) -> dict:
        """Return current balance and lifetime total for a member."""
        result = await db.execute(select(User).where(User.id == member_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError(message=f"Member {member_id} not found.")
        return {
            "balance": user.loyalty_points,
            "lifetime_total": user.loyalty_lifetime_points,
        }

    @staticmethod
    async def get_transactions(
        db: AsyncSession,
        member_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[LoyaltyTransaction]:
        """Return paginated transaction history for a member."""
        result = await db.execute(
            select(LoyaltyTransaction)
            .where(LoyaltyTransaction.member_id == member_id)
            .order_by(LoyaltyTransaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_leaderboard(db: AsyncSession, limit: int = 10) -> list[dict]:
        """Return top members by lifetime points earned."""
        result = await db.execute(
            select(User)
            .where(User.is_active == True, User.loyalty_lifetime_points > 0)  # noqa: E712
            .order_by(User.loyalty_lifetime_points.desc())
            .limit(limit)
        )
        users = list(result.scalars().all())
        return [
            {
                "rank": i + 1,
                "member_id": str(u.id),
                "full_name": u.full_name,
                "company_name": u.company_name,
                "tier": u.tier,
                "lifetime_points": u.loyalty_lifetime_points,
                "current_balance": u.loyalty_points,
            }
            for i, u in enumerate(users)
        ]
