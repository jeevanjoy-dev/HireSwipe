
"""add company admin

Revision ID: cd39e39f88d8
Revises: 3e1376a4170c
Create Date: 2026-11-05 17:22:27.735393

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cd39e39f88d8'
down_revision: Union[str, Sequence[str], None] = '3e1376a4170c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add company admin ownership and assign existing administrators."""

    # Add the column temporarily as nullable.
    op.add_column(
        'companies',
        sa.Column('admin_user_id', sa.Integer(), nullable=True)
    )

    # Create an explicitly named foreign-key constraint.
    op.create_foreign_key(
        'fk_companies_admin_user_id_users',
        'companies',
        'users',
        ['admin_user_id'],
        ['id']
    )

    op.create_index(
        'ix_companies_admin_user_id',
        'companies',
        ['admin_user_id'],
        unique=False
    )

    # Assign each existing company to its associated recruiter.
    op.execute(
        sa.text("""
            UPDATE companies
            SET admin_user_id = (
                SELECT recruiter_profiles.user_id
                FROM recruiter_profiles
                WHERE recruiter_profiles.company_id = companies.id
            )
            WHERE admin_user_id IS NULL
        """)
    )

    # Verify every company has an administrator.
    connection = op.get_bind()

    missing_admins = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM companies
            WHERE admin_user_id IS NULL
        """)
    ).scalar_one()

    if missing_admins > 0:
        raise RuntimeError(
            f"{missing_admins} companies do not have an assigned admin."
        )

    # Make admin_user_id mandatory after backfilling.
    op.alter_column(
        'companies',
        'admin_user_id',
        existing_type=sa.Integer(),
        nullable=False
    )


def downgrade() -> None:
    """Remove company admin ownership."""

    op.drop_index(
        'ix_companies_admin_user_id',
        table_name='companies'
    )

    op.drop_constraint(
        'fk_companies_admin_user_id_users',
        'companies',
        type_='foreignkey'
    )

    op.drop_column('companies', 'admin_user_id')
