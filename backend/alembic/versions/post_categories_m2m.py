"""post categories m2m

Revision ID: post_categories_m2m
Revises: add_media_table
Create Date: 2026-01-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'post_categories_m2m'
down_revision = 'add_media_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 创建 post_categories 多对多关联表
    op.create_table(
        'post_categories',
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ),
        sa.PrimaryKeyConstraint('post_id', 'category_id')
    )

    # 2. 将现有数据从 posts.category_id 迁移到 post_categories
    # 注意：这里假设 posts 表已经存在并且有 category_id 列
    op.execute(
        "INSERT INTO post_categories (post_id, category_id) "
        "SELECT id, category_id FROM posts WHERE category_id IS NOT NULL"
    )

    # 3. 删除 posts 表中的 category_id 列
    op.drop_constraint('posts_category_id_fkey', 'posts', type_='foreignkey')
    op.drop_column('posts', 'category_id')


def downgrade() -> None:
    # 1. 在 posts 表中重新添加 category_id 列
    op.add_column('posts', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key('posts_category_id_fkey', 'posts', 'categories', ['category_id'], ['id'])

    # 2. 将数据从 post_categories 迁回 posts.category_id
    # 注意：如果一个文章有多个分类，迁回时只能保留一个（通常是第一个）
    op.execute(
        "UPDATE posts SET category_id = ("
        "SELECT category_id FROM post_categories "
        "WHERE post_categories.post_id = posts.id "
        "LIMIT 1)"
    )

    # 3. 删除 post_categories 表
    op.drop_table('post_categories')
