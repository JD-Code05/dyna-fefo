from datetime import UTC, datetime

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from alembic import command
from app.core.config import get_settings
from app.core.deps import get_db
from app.core.products import load_products
from app.db.seed import seed
from app.main import create_app

NOW = datetime.now(UTC).replace(microsecond=0)


def iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


NOW_ISO = iso(NOW)

_engine = create_engine(get_settings().test_database_url)


@pytest.fixture(scope="session")
def _migrated():
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", get_settings().test_database_url)
    command.upgrade(cfg, "head")


@pytest.fixture(autouse=True)
def _clean(_migrated):
    yield
    with _engine.begin() as c:
        tables = [
            r[0]
            for r in c.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'")
            )
        ]
        if tables:
            c.execute(text("TRUNCATE " + ",".join(f'"{t}"' for t in tables) + " RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    with Session(_engine) as s:
        yield s


@pytest.fixture
def client(db):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


@pytest.fixture
def seeded(db):
    seed(db)


@pytest.fixture
def products():
    return load_products(get_settings().products_path)


AGED_NOW = NOW


@pytest.fixture
def aged_batch_with_rec(db, seeded, products):
    """CHK-004 in chiller-a, 210 h old at 4 C all along: ratio 0.125 -> pending PRIORITY_DISPATCH."""
    from datetime import timedelta

    from app.db.models import Batch, Recommendation, Telemetry
    from app.services.rul_jobs import recompute_all

    b = db.query(Batch).filter_by(code="CHK-004").one()
    b.zone_id, b.received_at = "chiller-a", AGED_NOW - timedelta(hours=210)
    b.printed_expiry = b.received_at + timedelta(days=10)
    for i in range(211):
        db.add(
            Telemetry(
                device_id="esp32-chiller-01",
                zone_id="chiller-a",
                seq=i,
                humidity_pct=85,
                ts=b.received_at + timedelta(hours=i),
                temperature_c=4,
            )
        )
    db.commit()
    recompute_all(db, products, AGED_NOW)
    rec = db.query(Recommendation).filter_by(batch_id=b.id, status="pending").one()
    return rec.id, b.id
