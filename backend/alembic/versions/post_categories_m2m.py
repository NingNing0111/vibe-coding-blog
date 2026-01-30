"""post categories m2m

Revision ID: post_categories_m2m
Revises: add_media_table
Create Date: 2026-01-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'post_categories_m2m'
down_revision = 'add_media_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 创建 post_categories 多对多关联表（若已存在则跳过）
    op.execute("""
        CREATE TABLE IF NOT EXISTS post_categories (
            post_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, category_id),
            FOREIGN KEY (post_id) REFERENCES posts (id),
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )
    """)
    # 2. 若 posts 仍有 category_id 列，则迁移数据并删除该列
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'category_id'
            ) THEN
                INSERT INTO post_categories (post_id, category_id)
                SELECT id, category_id FROM posts WHERE category_id IS NOT NULL
                ON CONFLICT (post_id, category_id) DO NOTHING;
                ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_id_fkey;
                ALTER TABLE posts DROP COLUMN IF EXISTS category_id;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.add_column('posts', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key('posts_category_id_fkey', 'posts', 'categories', ['category_id'], ['id'])
    op.execute(
        "UPDATE posts SET category_id = ("
        "SELECT category_id FROM post_categories WHERE post_categories.post_id = posts.id LIMIT 1)"
    )
    op.drop_table('post_categories')
