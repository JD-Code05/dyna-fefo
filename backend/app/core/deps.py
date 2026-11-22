from collections.abc import Callable, Iterator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import username_from_token
from app.db.models import Role, User
from app.db.session import SessionLocal


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


_bearer = HTTPBearer(auto_error=False)  # also gives /docs its Authorize button


def get_current_user(
    db: Session = Depends(get_db), cred: HTTPAuthorizationCredentials | None = Depends(_bearer)
) -> User:
    # The role is read from the DB on every request, so a changed role applies at once (not at token expiry).
    username = username_from_token(cred.credentials) if cred else None
    user = db.scalar(select(User).where(User.username == username)) if username else None
    if user is None:
        raise ApiError(401, "not_authenticated", "Sign in required")
    return user


def require_role(role: Role) -> Callable[..., User]:
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role != role.value:
            raise ApiError(403, "forbidden", f"Requires role {role.value}")
        return user

    return dep


def get_live(db: Session, model, id, not_found_code: str):
    obj = db.get(model, id)
    if obj is None or obj.deleted_at is not None:
        raise ApiError(404, not_found_code, f"{model.__name__} not found")
    return obj
