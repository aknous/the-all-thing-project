"""remove_region_column_from_vote_ballots

Revision ID: 5301g20f628f
Revises: 4200f19e617e
Create Date: 2026-01-10 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5301g20f628f'
down_revision: Union[str, Sequence[str], None] = '4200f19e617e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove region column from voteBallots table."""
    op.drop_column('voteBallots', 'region')


def downgrade() -> None:
    """Re-add region column to voteBallots table."""
    op.add_column('voteBallots', sa.Column('region', sa.String(length=50), nullable=True))
