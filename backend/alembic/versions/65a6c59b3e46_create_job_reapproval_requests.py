
"""create job reapproval requests

Revision ID: 65a6c59b3e46
Revises: 047a477ef031
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "65a6c59b3e46"
down_revision: Union[str, Sequence[str], None] = "047a477ef031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job_reapproval_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("recruiter_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("recruiter_message", sa.Text(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),

        sa.ForeignKeyConstraint(
            ["job_id"],
            ["jobs.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recruiter_id"],
            ["recruiter_profiles.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_job_reapproval_requests_id",
        "job_reapproval_requests",
        ["id"],
        unique=False,
    )

    op.create_index(
        "ix_job_reapproval_requests_job_status",
        "job_reapproval_requests",
        ["job_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.execute(
        "DROP TABLE IF EXISTS job_reapproval_requests CASCADE"
    )