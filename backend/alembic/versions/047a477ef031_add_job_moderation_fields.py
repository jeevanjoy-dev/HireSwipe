
"""add job moderation fields

Revision ID: 047a477ef031
Revises: 0b798cd1c61c
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "047a477ef031"
down_revision: Union[str, Sequence[str], None] = "0b798cd1c61c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Job moderation fields
    op.add_column(
        "jobs",
        sa.Column(
            "moderation_status",
            sa.String(length=30),
            nullable=False,
            server_default="normal",
        ),
    )

    op.add_column(
        "jobs",
        sa.Column("moderation_reason", sa.Text(), nullable=True),
    )

    op.add_column(
        "jobs",
        sa.Column("moderated_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "jobs",
        sa.Column("moderated_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_jobs_moderated_by_users",
        "jobs",
        "users",
        ["moderated_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # Recruiter blocking fields
    op.add_column(
        "users",
        sa.Column(
            "is_blocked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "users",
        sa.Column("blocked_reason", sa.String(length=1000), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("blocked_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("blocked_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_users_blocked_by_users",
        "users",
        "users",
        ["blocked_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # Remove database defaults after existing rows are populated.
    op.alter_column(
        "jobs",
        "moderation_status",
        server_default=None,
    )

    op.alter_column(
        "users",
        "is_blocked",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_users_blocked_by_users",
        "users",
        type_="foreignkey",
    )

    op.drop_column("users", "blocked_by")
    op.drop_column("users", "blocked_at")
    op.drop_column("users", "blocked_reason")
    op.drop_column("users", "is_blocked")

    op.drop_constraint(
        "fk_jobs_moderated_by_users",
        "jobs",
        type_="foreignkey",
    )

    op.drop_column("jobs", "moderated_by")
    op.drop_column("jobs", "moderated_at")
    op.drop_column("jobs", "moderation_reason")
    op.drop_column("jobs", "moderation_status")
