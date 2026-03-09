"""NFC service — handles tap events, card binding and management."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AlreadyExistsError, BadRequestError, NotFoundError
from app.repositories import nfc as nfc_repo
from app.repositories import locker as locker_repo
from app.repositories import tab as tab_repo
from app.repositories import connection as conn_repo
from app.schemas.nfc import BatchImportItem, TapResponse


class NfcService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def handle_tap(
        self,
        card_id: str,
        reader_id: str | None = None,
        location: str | None = None,
    ) -> TapResponse:
        card = await nfc_repo.get_card_by_card_id(self.db, card_id)
        if card is None:
            raise NotFoundError(message=f"NFC card not found: {card_id}")

        if card.status in ("suspended", "lost", "replaced"):
            return TapResponse(
                action="card_suspended",
                message="This card has been deactivated. Please contact club staff.",
            )

        if card.status == "unbound":
            return TapResponse(
                action="setup",
                redirect_url=f"/setup?cid={card_id}",
                message="Welcome! Please complete your profile to activate your membership.",
            )

        # Active card — log venue entry tap
        await nfc_repo.log_tap_event(
            self.db,
            card_id=card_id,
            tap_type="venue_entry",
            member_id=card.member_id,
            reader_id=reader_id,
            location=location or "entrance",
        )
        await nfc_repo.update_card(
            self.db,
            card,
            last_tap_at=datetime.utcnow(),
            tap_count=card.tap_count + 1,
        )

        member_name = None
        if card.member:
            member_name = card.member.full_name

        return TapResponse(
            action="welcome",
            member_id=card.member_id,
            member_name=member_name,
            message=f"Welcome back{', ' + member_name if member_name else ''}!",
        )

    async def bind_card(self, card_id: str, member_id: uuid.UUID) -> dict:
        card = await nfc_repo.get_card_by_card_id(self.db, card_id)
        if card is None:
            raise NotFoundError(message=f"NFC card not found: {card_id}")
        if card.status != "unbound":
            raise BadRequestError(message=f"Card '{card_id}' is already bound or inactive.")

        await nfc_repo.update_card(
            self.db,
            card,
            member_id=member_id,
            status="active",
            bound_at=datetime.utcnow(),
        )
        await nfc_repo.log_tap_event(
            self.db,
            card_id=card_id,
            tap_type="profile_created",
            member_id=member_id,
        )
        await nfc_repo.update_card(self.db, card, tap_count=card.tap_count + 1)

        return {"card_id": card_id, "status": "active", "message": "Card activated successfully."}

    async def suspend_card(self, card_id: str) -> dict:
        card = await nfc_repo.get_card_by_card_id(self.db, card_id)
        if card is None:
            raise NotFoundError(message=f"NFC card not found: {card_id}")
        await nfc_repo.update_card(self.db, card, status="suspended")
        return {"card_id": card_id, "status": "suspended"}

    async def get_card_status(self, card_id: str):
        card = await nfc_repo.get_card_by_card_id(self.db, card_id)
        if card is None:
            raise NotFoundError(message=f"NFC card not found: {card_id}")
        return card

    async def batch_import(self, cards: list[BatchImportItem]) -> int:
        items = [{"card_id": c.card_id, "tier_at_issue": c.tier_at_issue} for c in cards]
        return await nfc_repo.batch_create_cards(self.db, items)

    async def get_member_cards(self, member_id: uuid.UUID):
        return await nfc_repo.get_cards_by_member(self.db, member_id)

    async def get_tap_history(self, member_id: uuid.UUID, skip: int = 0, limit: int = 50):
        return await nfc_repo.get_tap_history(self.db, member_id, skip=skip, limit=limit)

    async def handle_connection_tap(
        self,
        card_id_a: str,
        card_id_b: str,
        reader_id: str | None = None,
        location: str | None = None,
    ) -> TapResponse:
        card_a = await nfc_repo.get_card_by_card_id(self.db, card_id_a)
        if card_a is None:
            raise NotFoundError(message=f"NFC card not found: {card_id_a}")
        card_b = await nfc_repo.get_card_by_card_id(self.db, card_id_b)
        if card_b is None:
            raise NotFoundError(message=f"NFC card not found: {card_id_b}")

        if card_a.status != "active":
            raise BadRequestError(message=f"Card {card_id_a} is not active.")
        if card_b.status != "active":
            raise BadRequestError(message=f"Card {card_id_b} is not active.")

        member_a_id = card_a.member_id
        member_b_id = card_b.member_id

        if await conn_repo.exists(self.db, member_a_id, member_b_id):
            raise AlreadyExistsError(message="These members are already connected.")

        tap_event = await nfc_repo.log_tap_event(
            self.db,
            card_id=card_id_a,
            tap_type="connection_tap",
            member_id=member_a_id,
            reader_id=reader_id,
            location=location,
            metadata={"partner_card_id": card_id_b, "partner_member_id": str(member_b_id)},
        )

        await conn_repo.create(
            self.db,
            member_a_id=member_a_id,
            member_b_id=member_b_id,
            connection_type="tap",
            tap_event_id=tap_event.id,
        )

        member_b_name = card_b.member.full_name if card_b.member else None
        return TapResponse(
            action="connection_made",
            member_id=member_a_id,
            member_name=member_b_name,
            message=f"Connected with {member_b_name or 'member'}!",
        )

    async def handle_payment_tap(
        self,
        card_id: str,
        amount: Decimal,
        description: str,
        reader_id: str | None = None,
    ) -> TapResponse:
        card = await nfc_repo.get_card_by_card_id(self.db, card_id)
        if card is None:
            raise NotFoundError(message=f"NFC card not found: {card_id}")
        if card.status != "active":
            raise BadRequestError(message=f"Card {card_id} is not active.")

        member_id = card.member_id

        tab = await tab_repo.get_open_tab(self.db, member_id)
        if tab is None:
            tab = await tab_repo.create_tab(self.db, member_id)

        tap_event = await nfc_repo.log_tap_event(
            self.db,
            card_id=card_id,
            tap_type="payment_tap",
            member_id=member_id,
            reader_id=reader_id,
            metadata={"amount": str(amount), "description": description},
        )

        await tab_repo.add_item(self.db, tab, description, amount, tap_event.id)

        return TapResponse(
            action="payment_added",
            member_id=member_id,
            member_name=card.member.full_name if card.member else None,
            message=f"Added {description} (฿{amount:,.0f}) to tab. Total: ฿{tab.total_amount:,.0f}",
        )

    async def handle_locker_tap(
        self,
        card_id: str,
        locker_number: str,
        reader_id: str | None = None,
    ) -> TapResponse:
        card = await nfc_repo.get_card_by_card_id(self.db, card_id)
        if card is None:
            raise NotFoundError(message=f"NFC card not found: {card_id}")
        if card.status != "active":
            raise BadRequestError(message=f"Card {card_id} is not active.")

        member_id = card.member_id

        locker = await locker_repo.get_by_number(self.db, locker_number)
        if locker is None:
            raise NotFoundError(message=f"Locker {locker_number} not found.")

        current_locker = await locker_repo.get_by_member(self.db, member_id)

        if current_locker is not None:
            if current_locker.locker_number == locker_number:
                # Same locker — release it
                await locker_repo.release(self.db, locker)
                action = "locker_released"
                message = f"Locker {locker_number} released."
            else:
                # Different locker already assigned
                action = "locker_already_assigned"
                message = f"You already have locker {current_locker.locker_number}."
        elif locker.status == "available":
            await locker_repo.assign(self.db, locker, member_id)
            action = "locker_assigned"
            message = f"Locker {locker_number} assigned to you."
        else:
            action = "locker_occupied"
            message = f"Locker {locker_number} is currently occupied."

        await nfc_repo.log_tap_event(
            self.db,
            card_id=card_id,
            tap_type="locker_access",
            member_id=member_id,
            reader_id=reader_id,
            metadata={"locker_number": locker_number, "action": action},
        )

        return TapResponse(
            action=action,
            member_id=member_id,
            member_name=card.member.full_name if card.member else None,
            message=message,
        )
