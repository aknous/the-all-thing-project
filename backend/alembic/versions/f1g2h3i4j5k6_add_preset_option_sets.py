"""add_preset_option_sets

Revision ID: f1g2h3i4j5k6
Revises: 126b12d82727
Create Date: 2026-01-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1g2h3i4j5k6'
down_revision: Union[str, None] = '126b12d82727'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create presetOptionSets table
    op.create_table('presetOptionSets',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updatedAt', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_presetOptionSets_name'), 'presetOptionSets', ['name'], unique=True)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_presetOptionSets_name'), table_name='presetOptionSets')
    
    # Drop table
    op.drop_table('presetOptionSets')
