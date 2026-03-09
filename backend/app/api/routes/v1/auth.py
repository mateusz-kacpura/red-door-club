
"""Authentication routes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DBSession, UserSvc
from app.core.exceptions import AuthenticationError
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.schemas.token import RefreshTokenRequest, Token
from app.schemas.user import UserCreate, UserRead

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    user_service: UserSvc,
):
    """OAuth2 compatible token login.

    Returns access token and refresh token.
    Raises domain exceptions handled by exception handlers.
    """
    user = await user_service.authenticate(form_data.username, form_data.password)
    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    return Token(access_token=access_token, refresh_token=refresh_token)


class UserCreateWithPromo(UserCreate):
    """Extended registration schema that accepts an optional promo code and tier override."""
    promo_code: str | None = None
    tier_grant: str | None = None
    pass_id: str | None = None


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreateWithPromo,
    user_service: UserSvc,
    db: DBSession,
):
    """Register a new user.

    Raises AlreadyExistsError if email is already registered.
    If a valid promo_code is provided it is applied after registration.
    If a valid pass_id is provided the QR code is marked as converted.
    """
    user = await user_service.register(user_in)
    if user_in.promo_code:
        try:
            from app.services.promoter import PromoterService
            await PromoterService.validate_and_apply_code(
                db, user_in.promo_code, user, tier_override=user_in.tier_grant
            )
        except Exception:
            pass  # promo code failure must not block registration
    if user_in.pass_id:
        try:
            from app.services.qr_batch import mark_converted
            await mark_converted(db, user_in.pass_id, user.id)
        except Exception:
            pass  # QR tracking failure must not block registration
    return user


@router.post("/refresh", response_model=Token)
async def refresh_token(
    body: RefreshTokenRequest,
    user_service: UserSvc,
):
    """Get new access token using refresh token.

    Raises AuthenticationError if refresh token is invalid or expired.
    """

    payload = verify_token(body.refresh_token)
    if payload is None:
        raise AuthenticationError(message="Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise AuthenticationError(message="Invalid token type")

    user_id = payload.get("sub")
    if user_id is None:
        raise AuthenticationError(message="Invalid token payload")

    # Verify user still exists and is active
    user = await user_service.get_by_id(UUID(user_id))
    if not user.is_active:
        raise AuthenticationError(message="User account is disabled")

    access_token = create_access_token(subject=str(user.id))
    new_refresh_token = create_refresh_token(subject=str(user.id))
    return Token(access_token=access_token, refresh_token=new_refresh_token)


@router.get("/me", response_model=UserRead)
async def get_current_user_info(current_user: CurrentUser):
    """Get current authenticated user information."""
    return current_user
