
"""Add request specific business email verification

Revision ID: cd3eff0110c6
Revises: 7fa18f78bb3b
Create Date: 2026-11-16 18:01:24.270132

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd3eff0110c6'
down_revision: Union[str, Sequence[str], None] = '7fa18f78bb3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add request-specific business email verification fields."""

    op.add_column(
        'company_verification_requests',
        sa.Column(
            'business_email',
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        'company_verification_requests',
        sa.Column(
            'business_email_verified',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        'company_verification_requests',
        sa.Column(
            'business_email_verified_at',
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.add_column(
        'company_verification_requests',
        sa.Column(
            'business_email_otp_hash',
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        'company_verification_requests',
        sa.Column(
            'business_email_otp_expires_at',
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.add_column(
        'company_verification_requests',
        sa.Column(
            'business_email_otp_attempts',
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    op.add_column(
        'company_verification_requests',
        sa.Column(
            'business_email_otp_last_sent_at',
            sa.DateTime(),
            nullable=True,
        ),
    )

    # Remove temporary server defaults.
    op.alter_column(
        'company_verification_requests',
        'business_email_verified',
        server_default=None,
    )

    op.alter_column(
        'company_verification_requests',
        'business_email_otp_attempts',
        server_default=None,
    )


def downgrade() -> None:
    """Remove request-specific business email verification fields."""

    op.drop_column(
        'company_verification_requests',
        'business_email_otp_last_sent_at',
    )

    op.drop_column(
        'company_verification_requests',
        'business_email_otp_attempts',
    )

    op.drop_column(
        'company_verification_requests',
        'business_email_otp_expires_at',
    )

    op.drop_column(
        'company_verification_requests',
        'business_email_otp_hash',
    )

    op.drop_column(
        'company_verification_requests',
        'business_email_verified_at',
    )

    op.drop_column(
        'company_verification_requests',
        'business_email_verified',
    )

    op.drop_column(
        'company_verification_requests',
        'business_email',
    )
