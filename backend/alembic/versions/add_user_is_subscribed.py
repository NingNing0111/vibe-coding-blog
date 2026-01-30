"""add user is_subscribed

Revision ID: add_user_is_subscribed
Revises: add_github_trending
Create Date: 2026-01-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "add_user_is_subscribed"
down_revision = "add_github_trending"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN NOT NULL DEFAULT true"
    )


def downgrade() -> None:
    op.drop_column("users", "is_subscribed")
