from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.dependencies.auth import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, get_current_user, get_user_from_token
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserRead, UserThemeUpdate


router = APIRouter(prefix="/auth", tags=["auth"])
_login_failures: dict[str, tuple[int, datetime]] = {}


def _cookie_secure() -> bool:
    return bool(get_settings().auth_cookie_secure)


def _cookie_samesite() -> str:
    return get_settings().auth_cookie_samesite or "lax"


def _cookie_domain() -> None:
    return None


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    settings = get_settings()
    secure = _cookie_secure()
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=secure,
        samesite=_cookie_samesite(),
        path="/",
        domain=_cookie_domain(),
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=secure,
        samesite=_cookie_samesite(),
        path="/auth",
        domain=_cookie_domain(),
    )


def _clear_auth_cookies(response: Response) -> None:
    secure = _cookie_secure()
    for name, path in ((ACCESS_COOKIE_NAME, "/"), (REFRESH_COOKIE_NAME, "/auth")):
        response.delete_cookie(name, path=path, domain=_cookie_domain(), secure=secure, samesite=_cookie_samesite())


def _issue_tokens(user: User, response: Response) -> str:
    access_token = create_access_token(str(user.id), {"email": user.email})
    refresh_token = create_refresh_token(str(user.id), {"email": user.email})
    _set_auth_cookies(response, access_token, refresh_token)
    return access_token


def _client_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{email.lower()}"


def _check_login_lockout(key: str) -> None:
    settings = get_settings()
    count, locked_until = _login_failures.get(key, (0, datetime.min.replace(tzinfo=UTC)))
    if count >= settings.login_max_failures and locked_until > datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
        )


def _record_login_failure(key: str) -> None:
    settings = get_settings()
    count, _ = _login_failures.get(key, (0, datetime.min.replace(tzinfo=UTC)))
    count += 1
    locked_until = datetime.now(UTC) + timedelta(minutes=settings.login_lockout_minutes)
    _login_failures[key] = (count, locked_until)


def _clear_login_failures(key: str) -> None:
    _login_failures.pop(key, None)


def _validate_password_or_422(password: str) -> None:
    try:
        validate_password_strength(password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from None


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    _validate_password_or_422(payload.password)
    existing_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        name=payload.name,
        graduation_year=payload.graduation_year,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = _issue_tokens(user, response)
    return TokenResponse(access_token=token, user=user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    key = _client_key(request, payload.email)
    _check_login_lockout(key)

    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        _record_login_failure(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    _clear_login_failures(key)
    token = _issue_tokens(user, response)
    return TokenResponse(access_token=token, user=user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> TokenResponse:
    if not refresh_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token was not provided.")
    user = get_user_from_token(refresh_cookie, db, "refresh")
    token = _issue_tokens(user, response)
    return TokenResponse(access_token=token, user=user)


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response) -> MessageResponse:
    _clear_auth_cookies(response)
    return MessageResponse(message="Logged out successfully.")


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me/theme", response_model=UserRead)
def update_theme(
    payload: UserThemeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    current_user.theme = payload.theme
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    _validate_password_or_422(payload.new_password)

    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    _issue_tokens(current_user, response)

    return MessageResponse(message="Password changed successfully.")


@router.post("/password-reset/request", response_model=PasswordResetResponse)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> PasswordResetResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    reset_token = create_password_reset_token(str(user.id), {"email": user.email}) if user else None
    return PasswordResetResponse(
        message="If that email is registered, password reset instructions will be sent.",
        reset_token=reset_token if get_settings().environment.lower() in {"development", "dev", "local", "test", "testing"} else None,
    )


@router.post("/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    _validate_password_or_422(payload.new_password)
    try:
        decoded = jwt.decode(
            payload.token,
            get_settings().jwt_secret_key,
            algorithms=[get_settings().jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.") from None

    if decoded.get("typ") != "password_reset" or decoded.get("sub") is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")

    try:
        user_id = int(decoded["sub"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.") from None

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")

    user.hashed_password = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    _clear_auth_cookies(response)
    return MessageResponse(message="Password reset successfully.")
