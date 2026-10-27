"""staff task confirmation: who handled an approved order, when, and why it was flagged

Revision ID: 0002
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade() -> None:
    op.add_column("recommendations", sa.Column("handled_by", sa.Integer, sa.ForeignKey("users.id")))
    op.add_column("recommendations", sa.Column("handled_at", sa.DateTime(timezone=True)))
    op.add_column("recommendations", sa.Column("flag_reason", sa.String))
    # Approvals made before approve became an order already moved their batch: close them so they never
    # reappear as staff tasks.
    op.execute(
        "UPDATE recommendations r SET status = 'done' FROM batches b "
        "WHERE r.batch_id = b.id AND r.status = 'approved' AND b.status <> 'active'"
    )


def downgrade() -> None:
    op.execute("UPDATE recommendations SET status = 'approved' WHERE status IN ('done', 'flagged')")
    op.drop_column("recommendations", "flag_reason")
    op.drop_column("recommendations", "handled_at")
    op.drop_column("recommendations", "handled_by")
