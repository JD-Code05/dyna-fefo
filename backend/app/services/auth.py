from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import create_token, verify_password
from app.db.models import AuditAction, AuditEntity, AuditLog, User
from app.services.audit import record

MAX_FAILS = 5
WINDOW = timedelta(minutes=15)
# Same answer for a wrong user and a wrong password, so the login form doesn't reveal which accounts exist.
_BAD = ApiError(401, "bad_credentials", "Wrong username or password")


def _recent_fails(db: Session, user: User, now: datetime) -> int:
    """Failed sign-ins in the last 15 minutes since the last success. Read from the audit log, so no extra table."""
    since = now - WINDOW
    last_ok = db.scalar(
        select(func.max(AuditLog.ts)).where(AuditLog.user_id == user.id, AuditLog.action == AuditAction.login.value)
    )
    if last_ok is not None and last_ok > since:
        since = last_ok
    return db.scalar(
        select(func.count()).where(
            AuditLog.user_id == user.id, AuditLog.action == AuditAction.login_failed.value, AuditLog.ts > since
        )
    )


def login(db: Session, username: str, password: str, now: datetime | None = None) -> tuple[User, str]:
    now = now or datetime.now(UTC)
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        verify_password(None, password)  # spend the same time as a real check
        raise _BAD
    if _recent_fails(db, user, now) >= MAX_FAILS:
        # Locked attempts are not counted, so the lock ends 15 minutes after the 5th failure.
        raise ApiError(423, "account_locked", "Too many failed sign-ins. Try again in 15 minutes.")
    ok = verify_password(user.password_hash, password)
    record(db, user, AuditAction.login if ok else AuditAction.login_failed, AuditEntity.user, user.id, None, None)
    db.commit()
    if not ok:
        raise _BAD
    return user, create_token(user.username, user.role, now)
