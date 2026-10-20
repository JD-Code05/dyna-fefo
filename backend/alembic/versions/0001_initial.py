"""initial schema

Revision ID: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None

TS = sa.DateTime(timezone=True)
NOW = sa.text("now()")


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
    op.create_table("users", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("username", sa.String, nullable=False, unique=True),
                    sa.Column("password_hash", sa.String), sa.Column("role", sa.String, nullable=False))
    op.create_table("products", sa.Column("id", sa.String, primary_key=True), sa.Column("name", sa.String, nullable=False),
                    *[sa.Column(c, sa.Float, nullable=False) for c in (
                        "shelf_life_ref_hours", "t_ref_c", "q10", "rate_floor", "max_dt_hours", "salvage_ratio", "dispatch_ratio")])
    op.create_table("zones", sa.Column("id", sa.String, primary_key=True), sa.Column("name", sa.String, nullable=False))
    op.create_table("devices", sa.Column("id", sa.String, primary_key=True), sa.Column("name", sa.String, nullable=False),
                    sa.Column("zone_id", sa.String, sa.ForeignKey("zones.id"), nullable=False),
                    sa.Column("api_key_hash", sa.String, nullable=False),
                    sa.Column("created_at", TS, nullable=False, server_default=NOW), sa.Column("deleted_at", TS))
    op.create_table("batches", sa.Column("id", sa.Integer, primary_key=True), sa.Column("code", sa.String, nullable=False),
                    sa.Column("product_id", sa.String, sa.ForeignKey("products.id"), nullable=False),
                    sa.Column("zone_id", sa.String, sa.ForeignKey("zones.id"), nullable=False),
                    sa.Column("received_at", TS, nullable=False), sa.Column("printed_expiry", TS, nullable=False),
                    sa.Column("quantity", sa.Integer, nullable=False), sa.Column("notes", sa.Text),
                    sa.Column("status", sa.String, nullable=False, server_default="active"),
                    sa.Column("created_at", TS, nullable=False, server_default=NOW),
                    sa.Column("updated_at", TS, nullable=False, server_default=NOW), sa.Column("deleted_at", TS))
    op.create_index("uq_batch_code_live", "batches", ["code"], unique=True, postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_table("telemetry", sa.Column("device_id", sa.String, primary_key=True),
                    sa.Column("seq", sa.BigInteger, primary_key=True), sa.Column("ts", TS, primary_key=True),
                    sa.Column("zone_id", sa.String, nullable=False), sa.Column("temperature_c", sa.Float, nullable=False),
                    sa.Column("humidity_pct", sa.Float, nullable=False))
    op.execute("SELECT create_hypertable('telemetry', 'ts')")
    op.create_index("ix_telemetry_zone_ts", "telemetry", ["zone_id", "ts"])
    op.create_table("batch_state", sa.Column("batch_id", sa.Integer, sa.ForeignKey("batches.id"), primary_key=True),
                    sa.Column("effective_age_h", sa.Float, nullable=False), sa.Column("rul_h", sa.Float, nullable=False),
                    sa.Column("rul_ratio", sa.Float, nullable=False), sa.Column("last_telemetry_ts", TS),
                    sa.Column("predicted_expiry", TS), sa.Column("computed_at", TS, nullable=False))
    op.create_table("batch_state_history", sa.Column("batch_id", sa.Integer, sa.ForeignKey("batches.id"), primary_key=True),
                    sa.Column("computed_at", TS, primary_key=True), sa.Column("rul_h", sa.Float, nullable=False),
                    sa.Column("rul_ratio", sa.Float, nullable=False), sa.Column("effective_age_h", sa.Float, nullable=False))
    op.create_table("recommendations", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("batch_id", sa.Integer, sa.ForeignKey("batches.id"), nullable=False),
                    sa.Column("type", sa.String, nullable=False), sa.Column("rationale", sa.JSON, nullable=False),
                    sa.Column("status", sa.String, nullable=False, server_default="pending"),
                    sa.Column("created_at", TS, nullable=False, server_default=NOW),
                    sa.Column("decided_by", sa.Integer, sa.ForeignKey("users.id")), sa.Column("decided_at", TS),
                    sa.Column("decision_note", sa.Text))
    op.create_table("audit_log", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
                    sa.Column("action", sa.String, nullable=False), sa.Column("entity", sa.String, nullable=False),
                    sa.Column("entity_id", sa.String, nullable=False), sa.Column("before", sa.JSON), sa.Column("after", sa.JSON),
                    sa.Column("ts", TS, nullable=False, server_default=NOW))


def downgrade() -> None:
    for t in ("audit_log", "recommendations", "batch_state_history", "batch_state", "telemetry",
              "batches", "devices", "zones", "products", "users"):
        op.drop_table(t)
