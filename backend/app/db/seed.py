import hashlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.products import load_products
from app.db.models import Batch, Device, Product, Role, User, Zone
from app.db.session import SessionLocal

ZONES = [("chiller-a", "Chiller A"), ("chiller-b", "Chiller B")]
# dev-only keys, documented in .env.example
DEVICES = [("esp32-chiller-01", "Chiller A Probe 01", "chiller-a", "dev-key-01"),
           ("esp32-chiller-02", "Chiller B Probe 02", "chiller-b", "dev-key-02")]
BATCHES = [("CHK-001", "chiller-a", 12, 40), ("CHK-002", "chiller-a", 72, 30),
           ("CHK-003", "chiller-b", 150, 25), ("CHK-004", "chiller-b", 210, 20)]


def seed(db: Session) -> None:
    if not db.scalar(select(User).where(User.username == "demo-supervisor")):
        db.add(User(username="demo-supervisor", password_hash=None, role=Role.supervisor.value))
    for cfg in load_products(get_settings().products_path).values():
        db.merge(Product(**cfg.model_dump()))
    for id_, name in ZONES:
        db.merge(Zone(id=id_, name=name))
    db.flush()
    for id_, name, zone, key in DEVICES:
        if not db.get(Device, id_):
            db.add(Device(id=id_, name=name, zone_id=zone, api_key_hash=hashlib.sha256(key.encode()).hexdigest()))
    now = datetime.now(UTC)
    for code, zone, age_h, qty in BATCHES:
        if not db.scalar(select(Batch).where(Batch.code == code, Batch.deleted_at.is_(None))):
            rec = now - timedelta(hours=age_h)
            db.add(Batch(code=code, product_id="chicken-breast", zone_id=zone, received_at=rec,
                         printed_expiry=rec + timedelta(days=10), quantity=qty))
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as s:
        seed(s)
