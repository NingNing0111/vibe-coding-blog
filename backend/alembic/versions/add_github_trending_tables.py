"""add github_trending and github_trending_llm tables

Revision ID: add_github_trending
Revises: post_categories_m2m
Create Date: 2026-01-30 10:00:00.000000

"""
from alembic import op

revision = "add_github_trending"
down_revision = "post_categories_m2m"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS github_trending (
            id SERIAL NOT NULL,
            trend_date DATE NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            description TEXT,
            language VARCHAR(64),
            stars INTEGER,
            forks INTEGER,
            stars_today INTEGER,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id),
            UNIQUE (trend_date, full_name)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_github_trending_trend_date ON github_trending (trend_date)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_github_trending_full_name ON github_trending (full_name)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS github_trending_llm (
            id SERIAL NOT NULL,
            trend_date DATE NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            intro TEXT,
            website TEXT,
            tags JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id),
            UNIQUE (trend_date, full_name)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_github_trending_llm_trend_date ON github_trending_llm (trend_date)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_github_trending_llm_full_name ON github_trending_llm (full_name)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_github_trending_llm_full_name")
    op.execute("DROP INDEX IF EXISTS idx_github_trending_llm_trend_date")
    op.execute("DROP TABLE IF EXISTS github_trending_llm")
    op.execute("DROP INDEX IF EXISTS idx_github_trending_full_name")
    op.execute("DROP INDEX IF EXISTS idx_github_trending_trend_date")
    op.execute("DROP TABLE IF EXISTS github_trending")
