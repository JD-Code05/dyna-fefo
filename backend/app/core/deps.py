from collections.abc import Callable, Iterator

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.models import Role, User
from app.db.session import SessionLocal


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def get_current_user(db: Session = Depends(get_db)) -> User:
    # AUTH_MODE=demo is the only mode: every request is the seeded supervisor.
    user = db.scalar(select(User).where(User.username == "demo-supervisor"))
    if user is None:
        raise ApiError(500, "demo_user_missing", "Demo user is not seeded; run python -m app.db.seed")
    return user


def require_role(role: Role) -> Callable[..., User]:
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role != role.value:
            raise ApiError(403, "forbidden", f"Requires role {role.value}")
        return user

    return dep
