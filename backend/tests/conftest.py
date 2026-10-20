from datetime import UTC, datetime

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

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
        tables = [r[0] for r in c.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'"))]
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
