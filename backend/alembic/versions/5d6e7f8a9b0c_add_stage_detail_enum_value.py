"""add_stage_detail_enum_value

Revision ID: 5d6e7f8a9b0c
Revises: 4c5d6e7f8a9b
Create Date: 2026-03-20

"""
from alembic import op


revision = '5d6e7f8a9b0c'
down_revision = '4c5d6e7f8a9b'
branch_labels = None
depends_on = None


def upgrade():
    # PostgreSQL requires ALTER TYPE to add a new enum value.
    # SQLite (used in tests) rebuilds the enum from the model, so no action needed there.
    op.execute("ALTER TYPE scrape_data_type ADD VALUE IF NOT EXISTS 'stage_detail'")


def downgrade():
    # PostgreSQL does not support removing enum values without a full type rebuild.
    # Downgrade is intentionally left as a no-op; remove rows with this data_type
    # manually before attempting a rollback if required.
    pass
