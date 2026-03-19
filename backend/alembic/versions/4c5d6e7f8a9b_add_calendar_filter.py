"""add_calendar_filter

Revision ID: 4c5d6e7f8a9b
Revises: 3b4c5d6e7f8a
Create Date: 2026-03-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '4c5d6e7f8a9b'
down_revision = '3b4c5d6e7f8a'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'calendar_filter',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('user_profile.id', ondelete='CASCADE'), nullable=False),
        sa.Column('label', sa.String(256), nullable=False),
        sa.Column('subscription_token', UUID(as_uuid=True), unique=True, nullable=False),
        sa.Column('filter_params', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table('calendar_filter')
