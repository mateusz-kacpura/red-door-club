"""Corporate account schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class CorporateAccountCreate(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    billing_contact_name: str = Field(min_length=2, max_length=255)
    billing_contact_email: EmailStr
    billing_address: str = ""
    vat_number: str | None = None
    package_type: str = "starter"  # starter(5) | business(20) | enterprise(50)
    annual_fee: Decimal = Decimal("0.00")
    renewal_date: datetime | None = None


class CorporateAccountUpdate(BaseModel):
    company_name: str | None = None
    billing_contact_name: str | None = None
    billing_contact_email: EmailStr | None = None
    billing_address: str | None = None
    vat_number: str | None = None
    package_type: str | None = None
    annual_fee: Decimal | None = None
    renewal_date: datetime | None = None
    status: str | None = None


class CorporateMemberRead(BaseModel):
    id: UUID
    corporate_id: UUID
    member_id: UUID
    role: str
    is_active: bool
    added_at: datetime
    member_name: str | None = None
    member_email: str | None = None

    model_config = {"from_attributes": True}


class CorporateAccountRead(BaseModel):
    id: UUID
    company_name: str
    billing_contact_name: str
    billing_contact_email: str
    billing_address: str
    vat_number: str | None
    package_type: str
    max_seats: int
    active_seats: int
    annual_fee: Decimal
    renewal_date: datetime | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AddCorporateMemberRequest(BaseModel):
    email: str


PACKAGE_SEAT_LIMITS = {"starter": 5, "business": 20, "enterprise": 50}
