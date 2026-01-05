"""add_featured_field_to_poll_templates

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-01-03 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add featured field to pollTemplates (default False)
    op.add_column('pollTemplates', 
        sa.Column('featured', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('pollTemplates', 'featured')
