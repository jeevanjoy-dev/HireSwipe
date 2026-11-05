
"""create company join requests

Revision ID: c2a474e254db
Revises: cd39e39f88d8
Create Date: 2026-11-05 18:16:22.678904
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2a474e254db'
down_revision: Union[str, Sequence[str], None] = 'cd39e39f88d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the company join requests table."""

    op.create_table(
        'company_join_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recruiter_id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('reviewed_by_user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['recruiter_id'], ['users.id']),
        sa.ForeignKeyConstraint(['reviewed_by_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index(
        'ix_company_join_requests_company_id',
        'company_join_requests',
        ['company_id']
    )

    op.create_index(
        'ix_company_join_requests_id',
        'company_join_requests',
        ['id']
    )

    op.create_index(
        'ix_company_join_requests_recruiter_id',
        'company_join_requests',
        ['recruiter_id']
    )


def downgrade() -> None:
    """Remove the company join requests table."""

    op.drop_index(
        'ix_company_join_requests_recruiter_id',
        table_name='company_join_requests'
    )

    op.drop_index(
        'ix_company_join_requests_id',
        table_name='company_join_requests'
    )

    op.drop_index(
        'ix_company_join_requests_company_id',
        table_name='company_join_requests'
    )

    op.drop_table('company_join_requests')
