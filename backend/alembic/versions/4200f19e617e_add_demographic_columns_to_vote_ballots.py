"""add_demographic_columns_to_vote_ballots

Revision ID: 4200f19e617e
Revises: 637c141b9261
Create Date: 2026-01-10 20:13:59.219291

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4200f19e617e'
down_revision: Union[str, Sequence[str], None] = '637c141b9261'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add demographic columns to voteBallots table
    # All columns are nullable since survey participation is optional
    
    op.add_column('voteBallots', sa.Column('ageRange', sa.String(length=20), nullable=True))
    op.add_column('voteBallots', sa.Column('gender', sa.String(length=50), nullable=True))
    op.add_column('voteBallots', sa.Column('race', sa.String(length=100), nullable=True))
    op.add_column('voteBallots', sa.Column('ethnicity', sa.String(length=100), nullable=True))
    op.add_column('voteBallots', sa.Column('state', sa.String(length=2), nullable=True))
    op.add_column('voteBallots', sa.Column('region', sa.String(length=50), nullable=True))
    op.add_column('voteBallots', sa.Column('urbanRuralSuburban', sa.String(length=20), nullable=True))
    op.add_column('voteBallots', sa.Column('politicalParty', sa.String(length=50), nullable=True))
    op.add_column('voteBallots', sa.Column('politicalIdeology', sa.String(length=50), nullable=True))
    op.add_column('voteBallots', sa.Column('religion', sa.String(length=100), nullable=True))
    op.add_column('voteBallots', sa.Column('educationLevel', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove demographic columns from voteBallots table
    
    op.drop_column('voteBallots', 'educationLevel')
    op.drop_column('voteBallots', 'religion')
    op.drop_column('voteBallots', 'politicalIdeology')
    op.drop_column('voteBallots', 'politicalParty')
    op.drop_column('voteBallots', 'urbanRuralSuburban')
    op.drop_column('voteBallots', 'region')
    op.drop_column('voteBallots', 'state')
    op.drop_column('voteBallots', 'ethnicity')
    op.drop_column('voteBallots', 'race')
    op.drop_column('voteBallots', 'gender')
    op.drop_column('voteBallots', 'ageRange')
