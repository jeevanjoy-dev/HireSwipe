
"""add company business phone otp verification

Revision ID: 8b923409e809
Revises: cd3eff0110c6
"""

from alembic import op
import sqlalchemy as sa


# Alembic revision identifiers
revision = "8b923409e809"
down_revision = "cd3eff0110c6"
branch_labels = None
depends_on = None


def upgrade() -> None:

    # 1. Phone verification status
    op.add_column(
        "companies",
        sa.Column(
            "business_phone_verified",
            sa.Boolean(),
            nullable=True
        )
    )

    # 2. OTP hash
    op.add_column(
        "companies",
        sa.Column(
            "business_phone_otp_hash",
            sa.String(length=255),
            nullable=True
        )
    )

    # 3. OTP expiry
    op.add_column(
        "companies",
        sa.Column(
            "business_phone_otp_expires_at",
            sa.DateTime(),
            nullable=True
        )
    )

    # 4. OTP attempts
    op.add_column(
        "companies",
        sa.Column(
            "business_phone_otp_attempts",
            sa.Integer(),
            nullable=True
        )
    )

    # 5. Last OTP sent timestamp
    op.add_column(
        "companies",
        sa.Column(
            "business_phone_otp_last_sent_at",
            sa.DateTime(),
            nullable=True
        )
    )

    # 6. Phone verification timestamp
    op.add_column(
        "companies",
        sa.Column(
            "business_phone_verified_at",
            sa.DateTime(),
            nullable=True
        )
    )

    # Populate existing company records
    op.execute(
        """
        UPDATE companies
        SET business_phone_verified = FALSE
        WHERE business_phone_verified IS NULL
        """
    )

    op.execute(
        """
        UPDATE companies
        SET business_phone_otp_attempts = 0
        WHERE business_phone_otp_attempts IS NULL
        """
    )

    # Make required fields NOT NULL
    op.alter_column(
        "companies",
        "business_phone_verified",
        existing_type=sa.Boolean(),
        nullable=False
    )

    op.alter_column(
        "companies",
        "business_phone_otp_attempts",
        existing_type=sa.Integer(),
        nullable=False
    )


def downgrade() -> None:

    op.drop_column(
        "companies",
        "business_phone_verified_at"
    )

    op.drop_column(
        "companies",
        "business_phone_otp_last_sent_at"
    )

    op.drop_column(
        "companies",
        "business_phone_otp_attempts"
    )

    op.drop_column(
        "companies",
        "business_phone_otp_expires_at"
    )

    op.drop_column(
        "companies",
        "business_phone_otp_hash"
    )

    op.drop_column(
        "companies",
        "business_phone_verified"
    )
