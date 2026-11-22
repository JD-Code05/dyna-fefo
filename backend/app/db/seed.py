import hashlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.products import load_products
from app.core.security import hash_password
from app.db.models import Batch, Device, Product, Role, User, Zone
from app.db.session import SessionLocal

# One chiller per product: raw chicken never shares a room with the ready-to-eat dish.
ZONES = [("chiller-a", "Chiller A"), ("chiller-b", "Chiller B"), ("chiller-c", "Chiller C")]
# dev-only keys, documented in .env.example
DEVICES = [
    ("esp32-chiller-01", "Chiller A Probe 01", "chiller-a", "dev-key-01"),
    ("esp32-chiller-02", "Chiller B Probe 02", "chiller-b", "dev-key-02"),
    ("esp32-chiller-03", "Chiller C Probe 03", "chiller-c", "dev-key-03"),
]
# (code, product, zone, age_h, quantity). Ages are picked so a fresh demo shows each outcome.
BATCHES = [
    ("CHK-001", "chicken-breast", "chiller-a", 8, 40),
    ("CHK-002", "chicken-breast", "chiller-a", 50, 30),
    # Outcomes use the MDP lines at 4 C (chicken dispatch < 0.19, salvage < 0.15; milk 0.14 / 0.11; tomato 0.24 / 0.19)
    ("CHK-003", "chicken-breast", "chiller-a", 105, 25),  # 38% left -> hold
    ("CHK-004", "chicken-breast", "chiller-a", 137, 20),  # 18% left -> dispatch for ~6 h, then salvage
    ("CHK-005", "chicken-breast", "chiller-a", 158, 15),  # 6% left -> salvage
    ("MLK-001", "fresh-milk", "chiller-b", 60, 20),
    ("MLK-002", "fresh-milk", "chiller-b", 204, 15),  # 13% left -> dispatch for ~5 h, then salvage
    ("TOM-001", "tomato-dish", "chiller-c", 30, 12),
    ("TOM-002", "tomato-dish", "chiller-c", 122, 10),  # 7% left -> salvage
]


def seed(db: Session) -> None:
    s = get_settings()
    for name, role, password in (
        ("demo-supervisor", Role.supervisor, s.demo_supervisor_password),
        ("demo-staff", Role.staff, s.demo_staff_password),
    ):
        user = db.scalar(select(User).where(User.username == name))
        if user is None:
            db.add(User(username=name, password_hash=hash_password(password), role=role.value))
        elif user.password_hash is None:  # users seeded before real login had no password
            user.password_hash = hash_password(password)
    products = load_products(s.products_path)
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
