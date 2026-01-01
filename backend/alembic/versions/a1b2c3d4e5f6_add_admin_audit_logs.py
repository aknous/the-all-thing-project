"""add_admin_audit_logs

Revision ID: a1b2c3d4e5f6
Revises: 0bbe5e854590
Create Date: 2025-12-30 16:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0bbe5e854590'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create adminAuditLogs table
    op.create_table('adminAuditLogs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('action', sa.String(length=128), nullable=False),
        sa.Column('entityType', sa.String(length=64), nullable=True),
        sa.Column('entityId', sa.String(length=36), nullable=True),
        sa.Column('adminKeyHash', sa.String(length=64), nullable=True),
        sa.Column('ipAddress', sa.String(length=45), nullable=True),
        sa.Column('userAgent', sa.String(length=256), nullable=True),
        sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('extraData', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('errorMessage', sa.Text(), nullable=True),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for common queries
    op.create_index(op.f('ix_adminAuditLogs_action'), 'adminAuditLogs', ['action'], unique=False)
    op.create_index(op.f('ix_adminAuditLogs_entityType'), 'adminAuditLogs', ['entityType'], unique=False)
    op.create_index(op.f('ix_adminAuditLogs_entityId'), 'adminAuditLogs', ['entityId'], unique=False)
    op.create_index(op.f('ix_adminAuditLogs_adminKeyHash'), 'adminAuditLogs', ['adminKeyHash'], unique=False)
    op.create_index(op.f('ix_adminAuditLogs_success'), 'adminAuditLogs', ['success'], unique=False)
    op.create_index(op.f('ix_adminAuditLogs_createdAt'), 'adminAuditLogs', ['createdAt'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_adminAuditLogs_createdAt'), table_name='adminAuditLogs')
    op.drop_index(op.f('ix_adminAuditLogs_success'), table_name='adminAuditLogs')
    op.drop_index(op.f('ix_adminAuditLogs_adminKeyHash'), table_name='adminAuditLogs')
    op.drop_index(op.f('ix_adminAuditLogs_entityId'), table_name='adminAuditLogs')
    op.drop_index(op.f('ix_adminAuditLogs_entityType'), table_name='adminAuditLogs')
    op.drop_index(op.f('ix_adminAuditLogs_action'), table_name='adminAuditLogs')
    
    # Drop table
    op.drop_table('adminAuditLogs')
