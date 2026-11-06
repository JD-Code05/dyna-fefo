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
DEVICES = [
    ("esp32-chiller-01", "Chiller A Probe 01", "chiller-a", "dev-key-01"),
    ("esp32-chiller-02", "Chiller B Probe 02", "chiller-b", "dev-key-02"),
]
# (code, product, zone, age_h, quantity). Ages are picked so a fresh demo shows each outcome.
BATCHES = [
    ("CHK-001", "chicken-breast", "chiller-a", 8, 40),
    ("CHK-002", "chicken-breast", "chiller-a", 50, 30),
    ("CHK-003", "chicken-breast", "chiller-b", 105, 25),  # 38% left -> dispatch
    ("CHK-004", "chicken-breast", "chiller-b", 147, 20),  # 12% left -> dispatch
    ("CHK-005", "chicken-breast", "chiller-b", 158, 15),  # 6% left -> salvage
    ("MLK-001", "fresh-milk", "chiller-a", 60, 20),
    ("MLK-002", "fresh-milk", "chiller-b", 140, 15),  # 40% left -> dispatch
    ("TOM-001", "tomato-dish", "chiller-a", 30, 12),
    ("TOM-002", "tomato-dish", "chiller-b", 122, 10),  # 7% left -> salvage
]


def seed(db: Session) -> None:
    if not db.scalar(select(User).where(User.username == "demo-supervisor")):
        db.add(User(username="demo-supervisor", password_hash=None, role=Role.supervisor.value))
    if not db.scalar(select(User).where(User.username == "demo-staff")):
        db.add(User(username="demo-staff", password_hash=None, role=Role.staff.value))
    products = load_products(get_settings().products_path)
    for cfg in products.values():
        db.merge(Product(**cfg.model_dump()))
    for id_, name in ZONES:
        db.merge(Zone(id=id_, name=name))
    db.flush()
    for id_, name, zone, key in DEVICES:
        if not db.get(Device, id_):
            db.add(Device(id=id_, name=name, zone_id=zone, api_key_hash=hashlib.sha256(key.encode()).hexdigest()))
    now = datetime.now(UTC)
    for code, product_id, zone, age_h, qty in BATCHES:
        if not db.scalar(select(Batch).where(Batch.code == code, Batch.deleted_at.is_(None))):
            rec = now - timedelta(hours=age_h)
            db.add(
                Batch(
                    code=code,
                    product_id=product_id,
                    zone_id=zone,
                    received_at=rec,
                    # the label is the shelf life at the reference temperature
                    printed_expiry=rec + timedelta(hours=products[product_id].shelf_life_ref_hours),
                    quantity=qty,
                )
            )
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as s:
        seed(s)
