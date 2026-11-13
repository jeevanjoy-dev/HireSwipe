
"""add company verification fields

Revision ID: 985c2c9c9627
Revises: ec966cf39f85
Create Date: 2026-11-13 12:15:11.674713
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Revision identifiers
revision: str = "985c2c9c9627"
down_revision: Union[str, Sequence[str], None] = "ec966cf39f85"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add company verification fields."""

    op.add_column(
        "companies",
        sa.Column("business_email", sa.String(255), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column("business_phone", sa.String(20), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column("business_address", sa.Text(), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column(
            "business_email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false()
        )
    )

    op.add_column(
        "companies",
        sa.Column("business_email_otp_hash", sa.String(255), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column("business_email_otp_expires_at", sa.DateTime(), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column(
            "business_email_otp_attempts",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0")
        )
    )

    op.add_column(
        "companies",
        sa.Column("business_email_otp_last_sent_at", sa.DateTime(), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column("business_email_verified_at", sa.DateTime(), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column("document_1", sa.String(255), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column("document_2", sa.String(255), nullable=True)
    )

    op.add_column(
        "companies",
        sa.Column(
            "documents_status",
            sa.String(30),
            nullable=False,
            server_default=sa.text("'not_submitted'")
        )
    )

    op.add_column(
        "companies",
        sa.Column(
            "verification_status",
            sa.String(30),
            nullable=False,
            server_default=sa.text("'unverified'")
        )
    )


def downgrade() -> None:
    """Remove company verification fields."""

    op.drop_column("companies", "verification_status")
    op.drop_column("companies", "documents_status")
    op.drop_column("companies", "document_2")
    op.drop_column("companies", "document_1")
    op.drop_column("companies", "business_email_verified_at")
    op.drop_column("companies", "business_email_otp_last_sent_at")
    op.drop_column("companies", "business_email_otp_attempts")
    op.drop_column("companies", "business_email_otp_expires_at")
    op.drop_column("companies", "business_email_otp_hash")
    op.drop_column("companies", "business_email_verified")
    op.drop_column("companies", "business_address")
    op.drop_column("companies", "business_phone")
    op.drop_column("companies", "business_email")
