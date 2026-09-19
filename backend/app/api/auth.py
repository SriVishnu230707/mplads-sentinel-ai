import uuid
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_event
from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..models import RefreshSession, User
from ..rate_limit import RateLimitUnavailable, login_attempt_limiter
from ..schemas import AccessToken, LoginRequest, UserOut
from ..security import DUMMY_PASSWORD_HASH, create_access_token, create_refresh_token, decode_token, hash_token, verify_password


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
