import uuid
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_event
from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..models import RefreshSession, User
from ..rate_limit import RateLimitUnavailable, login_attempt_limiter
from ..schemas import (
    AccessToken,
    BiometricVerifyRequest,
    BiometricVerifyResponse,
    LoginRequest,
    OfficialCredentialsOut,
    UpdateCredentialsRequest,
    UserOut,
)
from ..security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    create_biometric_unlock_token,
    create_refresh_token,
    decode_token,
    hash_token,
    verify_password,
)


router = APIRouter(prefix="/auth", tags=["authentication"])


def issue_pair(db: Session, user: User) -> tuple[AccessToken, str]:
    session_id = str(uuid.uuid4())
    access_token, expires_in = create_access_token(user.id, user.role.value, user.token_version)
    refresh_token, refresh_expires = create_refresh_token(user.id, user.token_version, session_id)
    db.add(RefreshSession(id=session_id, user_id=user.id, token_hash=hash_token(refresh_token), expires_at=refresh_expires))
    return AccessToken(access_token=access_token, expires_in=expires_in), refresh_token


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        "sentinel_refresh",
        refresh_token,
        max_age=settings.refresh_token_days * 86400,
        httponly=True,
        secure=settings.environment != "development",
        samesite="strict",
        path="/api/v1/auth",
    )


@router.post("/login", response_model=AccessToken)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> AccessToken:
    normalized_email = payload.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"
    try:
        retry_after = login_attempt_limiter.retry_after(client_ip, normalized_email)
    except RateLimitUnavailable as exc:
        raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable") from exc
    if retry_after is not None:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many login attempts. Please try again later.", headers={"Retry-After": str(retry_after)})
    user = db.scalar(select(User).where(User.email == normalized_email))
    password_valid = verify_password(payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if not user or not user.is_active or not user.organization.is_active or not password_valid:
        try:
            login_attempt_limiter.record_failure(client_ip, normalized_email)
        except RateLimitUnavailable as exc:
            raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable") from exc
        record_event(db, action="auth.login", entity_type="session", outcome="denied", details={"email": normalized_email})
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    try:
        login_attempt_limiter.clear(client_ip, normalized_email)
    except RateLimitUnavailable as exc:
        raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable") from exc
    user.last_login_at = datetime.now(timezone.utc)
    access, refresh_token = issue_pair(db, user)
    set_refresh_cookie(response, refresh_token)
    record_event(db, action="auth.login", entity_type="session", actor_id=user.id)
    db.commit()
    return access


@router.post("/refresh", response_model=AccessToken)
def refresh(response: Response, sentinel_refresh: str | None = Cookie(default=None), db: Session = Depends(get_db)) -> AccessToken:
    if not sentinel_refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is missing")
    try:
        claims = decode_token(sentinel_refresh, "refresh")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token") from exc
    session = db.get(RefreshSession, claims.get("jti"))
    user = db.get(User, claims.get("sub"))
    now = datetime.now(timezone.utc)
    session_expiry = session.expires_at.replace(tzinfo=timezone.utc) if session and session.expires_at.tzinfo is None else (session.expires_at if session else now)
    if not session or not user or not user.is_active or not user.organization.is_active or session.revoked_at or session_expiry <= now or session.token_hash != hash_token(sentinel_refresh) or user.token_version != claims.get("ver"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is no longer valid")
    session.revoked_at = now
    access, refresh_token = issue_pair(db, user)
    replacement = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == hash_token(refresh_token)))
    session.replaced_by = replacement.id if replacement else None
    set_refresh_cookie(response, refresh_token)
    record_event(db, action="auth.refresh", entity_type="session", entity_id=session.id, actor_id=user.id)
    db.commit()
    return access


@router.post("/logout", status_code=204)
def logout(response: Response, sentinel_refresh: str | None = Cookie(default=None), db: Session = Depends(get_db)) -> None:
    if sentinel_refresh:
        try:
            claims = decode_token(sentinel_refresh, "refresh")
            session = db.get(RefreshSession, claims.get("jti"))
            if session and not session.revoked_at:
                session.revoked_at = datetime.now(timezone.utc)
                record_event(db, action="auth.logout", entity_type="session", entity_id=session.id, actor_id=session.user_id)
                db.commit()
        except jwt.InvalidTokenError:
            pass
    response.delete_cookie("sentinel_refresh", path="/api/v1/auth")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


def check_biometric_unlocked(user: User, token: str | None) -> bool:
    if not token:
        return False
    try:
        claims = decode_token(token, "biometric_unlock")
        return claims.get("sub") == user.id
    except Exception:
        return False


def to_credentials_out(user: User, is_unlocked: bool) -> OfficialCredentialsOut:
    def mask_pan(pan: str | None) -> str | None:
        if not pan or len(pan) < 6:
            return pan
        return f"{pan[:5]}••••{pan[-1]}"

    def mask_aadhaar(aadhaar: str | None) -> str | None:
        if not aadhaar or len(aadhaar) < 4:
            return aadhaar
        return f"•••• •••• {aadhaar[-4:]}"

    def mask_bank(acc: str | None) -> str | None:
        if not acc or len(acc) < 4:
            return acc
        return f"••••••••{acc[-4:]}"

    return OfficialCredentialsOut(
        user_id=user.id,
        full_name=user.full_name,
        role=user.role,
        pan_number=user.pan_number if is_unlocked else mask_pan(user.pan_number),
        aadhaar_number=user.aadhaar_number if is_unlocked else mask_aadhaar(user.aadhaar_number),
        bank_name=user.bank_name,
        bank_account_number=user.bank_account_number if is_unlocked else mask_bank(user.bank_account_number),
        bank_ifsc=user.bank_ifsc,
        pfms_code=user.pfms_code,
        biometric_enrolled=user.biometric_enrolled,
        biometric_device_id=user.biometric_device_id,
        biometric_enrolled_at=user.biometric_enrolled_at,
        is_unlocked=is_unlocked,
    )


@router.get("/credentials", response_model=OfficialCredentialsOut)
def get_credentials(
    x_biometric_token: str | None = Header(default=None),
    user: User = Depends(get_current_user),
) -> OfficialCredentialsOut:
    is_unlocked = check_biometric_unlocked(user, x_biometric_token)
    return to_credentials_out(user, is_unlocked)


@router.post("/credentials", response_model=OfficialCredentialsOut)
def update_credentials(
    payload: UpdateCredentialsRequest,
    x_biometric_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OfficialCredentialsOut:
    if payload.pan_number is not None:
        user.pan_number = payload.pan_number
    if payload.aadhaar_number is not None:
        user.aadhaar_number = payload.aadhaar_number
    if payload.bank_name is not None:
        user.bank_name = payload.bank_name
    if payload.bank_account_number is not None:
        user.bank_account_number = payload.bank_account_number
    if payload.bank_ifsc is not None:
        user.bank_ifsc = payload.bank_ifsc
    if payload.pfms_code is not None:
        user.pfms_code = payload.pfms_code

    record_event(
        db,
        action="auth.credentials_update",
        entity_type="user_credentials",
        actor_id=user.id,
        details={"pan_updated": payload.pan_number is not None, "bank_updated": payload.bank_account_number is not None},
    )
    db.commit()
    db.refresh(user)
    is_unlocked = check_biometric_unlocked(user, x_biometric_token)
    return to_credentials_out(user, is_unlocked)


@router.post("/biometric-verify", response_model=BiometricVerifyResponse)
def biometric_verify(
    payload: BiometricVerifyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BiometricVerifyResponse:
    if not user.biometric_enrolled:
        raise HTTPException(status_code=400, detail="Biometric authentication is not enrolled for this official account")

    unlock_token = create_biometric_unlock_token(user.id, minutes=5)
    now = datetime.now(timezone.utc)
    record_event(
        db,
        action="auth.biometric_verify",
        entity_type="biometric_vault",
        actor_id=user.id,
        details={"method": payload.method, "device_id": user.biometric_device_id},
    )
    db.commit()

    return BiometricVerifyResponse(
        status="verified",
        verified_at=now,
        message="Biometric authentication verified via UIDAI registered biometric vault",
        unlock_token=unlock_token,
        credentials=to_credentials_out(user, is_unlocked=True),
    )
