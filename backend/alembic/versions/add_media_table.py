"""add media table

Revision ID: add_media_table
Revises: 
Create Date: 2026-01-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = 'add_media_table'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建 media 表
    op.create_table(
        'media',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('file_name', sa.String(), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('file_type', sa.String(), nullable=False),
        sa.Column('file_url', sa.String(), nullable=False),
        sa.Column('file_key', sa.String(), nullable=False),
        sa.Column('uploader_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_media_id'), 'media', ['id'], unique=False)
    op.create_index(op.f('ix_media_file_name'), 'media', ['file_name'], unique=False)
    op.create_index(op.f('ix_media_file_key'), 'media', ['file_key'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_media_file_key'), table_name='media')
    op.drop_index(op.f('ix_media_file_name'), table_name='media')
    op.drop_index(op.f('ix_media_id'), table_name='media')
    op.drop_table('media')
