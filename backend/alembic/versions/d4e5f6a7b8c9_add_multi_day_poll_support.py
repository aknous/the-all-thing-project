"""add_multi_day_poll_support

Revision ID: d4e5f6a7b8c9
Revises: 126b12d82727
Create Date: 2026-01-01 03:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = '126b12d82727'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add durationDays to pollTemplates (default 1 day)
    op.add_column('pollTemplates', 
        sa.Column('durationDays', sa.Integer(), nullable=False, server_default='1')
    )
    
    # Add closeDate to pollInstances
    # For existing instances, set closeDate = pollDate (single day polls)
    op.add_column('pollInstances',
        sa.Column('closeDate', sa.Date(), nullable=True)
    )
    
    # Update existing instances to have closeDate = pollDate
    op.execute('UPDATE "pollInstances" SET "closeDate" = "pollDate" WHERE "closeDate" IS NULL')
    
    # Now make closeDate non-nullable
    op.alter_column('pollInstances', 'closeDate', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('pollInstances', 'closeDate')
    op.drop_column('pollTemplates', 'durationDays')
