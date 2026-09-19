from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Project, Role, User
from .security import decode_token


bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = decode_token(credentials.credentials, "access")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc
    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active or not user.organization.is_active or user.token_version != payload.get("ver"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid")
    return user


def require_roles(*roles: Role) -> Callable:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permission")
        return user
    return dependency


def apply_project_scope(query, user: User):
    """Enforce jurisdiction at the data-query boundary, not in the UI."""
    org = user.organization
    if user.role in {Role.MINISTRY, Role.AUDITOR} and org.level.value == "national":
        return query
    if org.level.value == "state":
        return query.where(Project.state == org.state)
    if org.level.value == "district":
        return query.where(Project.state == org.state, Project.district == org.district)
    return query.where(Project.id == "__no_access__")
