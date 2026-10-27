from collections.abc import Callable, Iterator

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.models import Role, User
from app.db.session import SessionLocal


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def get_current_user(db: Session = Depends(get_db), x_demo_user: str | None = Header(None)) -> User:
    # AUTH_MODE=demo is the only mode: X-Demo-User: demo-staff picks the seeded staff user, anything else the
    # supervisor. Anyone can send the header; real login later replaces only this function.
    username = "demo-staff" if x_demo_user == "demo-staff" else "demo-supervisor"
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise ApiError(500, "demo_user_missing", "Demo user is not seeded; run python -m app.db.seed")
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
