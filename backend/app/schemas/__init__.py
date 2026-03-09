"""Pydantic schemas."""
# ruff: noqa: I001, RUF022 - Imports structured for Jinja2 template conditionals

from app.schemas.token import Token, TokenPayload
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.schemas.item import ItemCreate, ItemRead, ItemUpdate
from app.schemas.nfc import (
    NfcCardCreate, NfcCardRead, NfcCardUpdate,
    TapEventCreate, TapEventRead,
    TapResponse, BindCardRequest, BatchImportItem,
    ConnectionTapRequest, LockerTapRequest,
)
from app.schemas.event import EventCreate, EventRead, EventUpdate
from app.schemas.connection import ConnectionRead, UserSummary
from app.schemas.service_request import (
    ServiceRequestCreate, ServiceRequestRead, ServiceRequestUpdate,
    ServiceRequestAdminRead, ServiceRequestAdminUpdate,
)
from app.schemas.locker import LockerCreate, LockerRead
from app.schemas.tab import TabItemRead, TabRead, PaymentTapRequest
from app.schemas.analytics import RevenueAnalytics, TapEventAdminRead, TopSpender
from app.schemas.user import MemberDetail

__all__ = [
    'UserCreate', 'UserRead', 'UserUpdate', 'MemberDetail',
    'Token', 'TokenPayload',
    'ItemCreate', 'ItemRead', 'ItemUpdate',
    'NfcCardCreate', 'NfcCardRead', 'NfcCardUpdate',
    'TapEventCreate', 'TapEventRead',
    'TapResponse', 'BindCardRequest', 'BatchImportItem',
    'ConnectionTapRequest', 'LockerTapRequest',
    'EventCreate', 'EventRead', 'EventUpdate',
    'ConnectionRead', 'UserSummary',
    'ServiceRequestCreate', 'ServiceRequestRead', 'ServiceRequestUpdate',
    'ServiceRequestAdminRead', 'ServiceRequestAdminUpdate',
    'LockerCreate', 'LockerRead',
    'TabItemRead', 'TabRead', 'PaymentTapRequest',
    'RevenueAnalytics', 'TapEventAdminRead', 'TopSpender',
]
