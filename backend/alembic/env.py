from sqlalchemy import create_engine

from alembic import context
from app.core.config import get_settings

# conftest may override sqlalchemy.url to target the test DB
url = context.config.get_main_option("sqlalchemy.url") or get_settings().database_url

with create_engine(url).connect() as conn:
    context.configure(connection=conn, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()
