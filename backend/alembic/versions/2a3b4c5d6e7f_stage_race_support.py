"""stage_race_support

Revision ID: 2a3b4c5d6e7f
Revises: 1f76a204ea5c
Create Date: 2026-03-19

"""
from alembic import op
import sqlalchemy as sa

revision = '2a3b4c5d6e7f'
down_revision = '1f76a204ea5c'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('diary_entry', sa.Column('is_stage', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('diary_entry', sa.Column('stage_number', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('diary_entry', 'stage_number')
    op.drop_column('diary_entry', 'is_stage')
