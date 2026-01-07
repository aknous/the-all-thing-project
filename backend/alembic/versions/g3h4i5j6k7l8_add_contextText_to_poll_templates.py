"""add_contextText_to_poll_templates

Revision ID: g3h4i5j6k7l8
Revises: f1g2h3i4j5k6
Create Date: 2026-01-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g3h4i5j6k7l8'
down_revision: Union[str, Sequence[str], None] = 'f1g2h3i4j5k6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add contextText field to pollTemplates (nullable TEXT for markdown content)
    op.add_column('pollTemplates', 
        sa.Column('contextText', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('pollTemplates', 'contextText')
