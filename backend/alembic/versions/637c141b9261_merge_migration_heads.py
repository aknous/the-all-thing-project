"""merge_migration_heads

Revision ID: 637c141b9261
Revises: e5f6a7b8c9d0, g3h4i5j6k7l8
Create Date: 2026-01-10 20:13:53.407470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '637c141b9261'
down_revision: Union[str, Sequence[str], None] = ('e5f6a7b8c9d0', 'g3h4i5j6k7l8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
