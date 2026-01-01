"""add_subcategory_support

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-31 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add parentCategoryId column to pollCategories table
    op.add_column('pollCategories', 
        sa.Column('parentCategoryId', sa.String(length=36), nullable=True)
    )
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_pollCategories_parentCategory',
        'pollCategories', 'pollCategories',
        ['parentCategoryId'], ['id'],
        ondelete='CASCADE'
    )
    
    # Add index for better query performance
    op.create_index(
        op.f('ix_pollCategories_parentCategoryId'),
        'pollCategories',
        ['parentCategoryId'],
        unique=False
    )


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f('ix_pollCategories_parentCategoryId'), table_name='pollCategories')
    
    # Drop foreign key
    op.drop_constraint('fk_pollCategories_parentCategory', 'pollCategories', type_='foreignkey')
    
    # Drop column
    op.drop_column('pollCategories', 'parentCategoryId')
