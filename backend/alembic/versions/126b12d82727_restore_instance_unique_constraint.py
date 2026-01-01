"""restore_instance_unique_constraint

Revision ID: 126b12d82727
Revises: c3d4e5f6a7b8
Create Date: 2026-01-01 03:09:28.531657

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '126b12d82727'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop the non-unique index on (templateId, pollDate)
    op.drop_index('ix_pollInstances_template_date', table_name='pollInstances')
    
    # Add back the unique constraint on (templateId, pollDate)
    op.create_unique_constraint(
        'uq_pollInstances_template_date',
        'pollInstances',
        ['templateId', 'pollDate']
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove the unique constraint
    op.drop_constraint('uq_pollInstances_template_date', 'pollInstances', type_='unique')
    
    # Add back the non-unique index
    op.create_index('ix_pollInstances_template_date', 'pollInstances', ['templateId', 'pollDate'])
