"""remove_instance_unique_constraint

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2025-12-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the unique constraint on (templateId, pollDate)
    # This allows multiple instances from the same template on the same day
    # Enables testing flexibility and future multi-day polls
    op.drop_constraint('uq_pollInstances_template_date', 'pollInstances', type_='unique')
    
    # Add index on (templateId, pollDate) for query performance
    op.create_index(
        'ix_pollInstances_template_date',
        'pollInstances',
        ['templateId', 'pollDate'],
        unique=False
    )


def downgrade() -> None:
    # Drop the index
    op.drop_index('ix_pollInstances_template_date', table_name='pollInstances')
    
    # Recreate the unique constraint
    op.create_unique_constraint(
        'uq_pollInstances_template_date',
        'pollInstances',
        ['templateId', 'pollDate']
    )
